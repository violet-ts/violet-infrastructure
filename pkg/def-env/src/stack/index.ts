import { AwsProvider, ResourceGroups, S3, Route53, ECS, ECR, ACM, IAM } from '@cdktf/provider-aws';
import { NullProvider } from '@cdktf/provider-null';
import { TerraformLocal, TerraformOutput, TerraformStack } from 'cdktf';
import type { Construct } from 'constructs';
import type { ComputedOpEnv, DynamicOpEnv } from '@self/shared/lib/operate-env/op-env';
import type { SharedEnv } from '@self/shared/lib/def/env-vars';
import { PROJECT_NAME } from '@self/shared/lib/const';
import type { Section } from '@self/shared/lib/def/types';
import { z } from 'zod';
import type { OpTfOutput } from '@self/shared/lib/operate-env/output';
import { getHash6 } from '@self/shared/lib/util/string';
import { RandomProvider } from '@cdktf/provider-random';
import type { DynamicRunScriptEnv, ComputedRunScriptEnv } from '@self/shared/lib/run-script/env';
import type { CodeBuildStackEnv } from '@self/shared/lib/codebuild-stack/env';
import { HTTPTask } from './http-task';
import { MysqlDb } from './mysql';
import { genTags } from './values';
import { DataNetwork } from './data-network';

export interface VioletEnvOptions {
  region: string;
  section: Section;

  sharedEnv: SharedEnv;
  dynamicOpEnv: DynamicOpEnv;
  computedOpEnv: ComputedOpEnv;
  dynamicRunScriptEnv: DynamicRunScriptEnv;
  computedRunScriptEnv: ComputedRunScriptEnv;
  codeBuildStackEnv: CodeBuildStackEnv;
}

export class VioletEnvStack extends TerraformStack {
  private readonly nsPattern = /[a-zA-Z-]+/;

  constructor(scope: Construct, name: string, public options: VioletEnvOptions) {
    super(scope, name);

    if (!options.dynamicOpEnv.NAMESPACE.match(this.nsPattern)) {
      throw new Error(`Namespace option should satisfy ${this.nsPattern}: got ${options.dynamicOpEnv.NAMESPACE}`);
    }
  }

  /** len = 6 + 6 + 1 + 1 = 14 */
  private readonly prefix = `vio-e-${getHash6(this.options.dynamicOpEnv.NAMESPACE)}-${this.options.section[0]}`;

  readonly nullProvider = new NullProvider(this, 'nullProvider', {});

  readonly random = new RandomProvider(this, 'random', {});

  readonly aws = new AwsProvider(this, 'aws', {
    region: this.options.region,
    profile: process.env.AWS_PROFILE || undefined,
    defaultTags: {
      tags: genTags(null, this.options.dynamicOpEnv.NAMESPACE, this.options.section),
    },
  });

  readonly apiRepo = new ECR.DataAwsEcrRepository(this, 'apiRepo', {
    name: this.options.computedOpEnv.API_REPO_NAME,
  });

  readonly apiImage = new ECR.DataAwsEcrImage(this, 'apiImage', {
    repositoryName: this.apiRepo.name,
    // TODO(hardcoded)
    imageDigest: this.options.dynamicOpEnv.API_REPO_SHA,
  });

  readonly webRepo = new ECR.DataAwsEcrRepository(this, 'webRepo', {
    name: this.options.computedOpEnv.WEB_REPO_NAME,
  });

  readonly webImage = new ECR.DataAwsEcrImage(this, 'webImage', {
    repositoryName: this.webRepo.name,
    // TODO(hardcoded)
    imageDigest: this.options.dynamicOpEnv.WEB_REPO_SHA,
  });

  readonly zone = new Route53.DataAwsRoute53Zone(this, 'zone', {
    zoneId: this.options.sharedEnv.PREVIEW_ZONE_ID,
  });

  readonly certificate = new ACM.DataAwsAcmCertificate(this, 'certificate', {
    domain: z.string().parse(this.zone.name),
  });

  readonly network = new DataNetwork(this, 'network');

  // この namespace に属する Violet インフラを構築する、関連した
  // リソースの一覧
  readonly resourceGroups = new ResourceGroups.ResourcegroupsGroup(this, 'resourceGroups', {
    name: this.prefix,
    resourceQuery: {
      query: JSON.stringify({
        ResourceTypeFilters: ['AWS::AllSupported'],
        TagFilters: [
          {
            Key: 'Project',
            Values: [PROJECT_NAME],
          },
          {
            Key: 'Namespace',
            Values: [this.options.dynamicOpEnv.NAMESPACE],
          },
        ],
      }),
    },
    tagsAll: {
      Name: `Violet Resources in ${this.options.dynamicOpEnv.NAMESPACE}`,
    },
  });

  readonly mysql = new MysqlDb(this, 'mysql', {
    // len = 14 + 6 = 20
    prefix: `${this.prefix}-mysql`,
    subnets: this.network.publicSubnets,
    vpcSecurityGroups: [this.network.dbSg],
  });

  readonly dbURLLocal = new TerraformLocal(this, 'dbURLLocal', {
    value: this.mysql.dbURL,
  });

  // DB URL for prisma schema
  readonly dbURL = new TerraformOutput(this, 'dbURL', {
    value: this.mysql.dbURL,
    sensitive: true,
  });

  // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Cluster.html
  readonly cluster = new ECS.EcsCluster(this, 'cluster', {
    name: this.prefix,
    capacityProviders: ['FARGATE'],
    // TODO(security): for production
    // imageScanningConfiguration,
  });

  // Service level bucket
  // https://docs.aws.amazon.com/AmazonS3/latest/API/API_Types.html
  readonly s3 = new S3.S3Bucket(this, 's3', {
    // TODO(service): for prod: protection for deletion, versioning
    // TODO(security): for prod: encryption
    // TODO(logging): for prod
    // TODO(cost): for prod: lifecycle
    bucket: this.prefix,
    forceDestroy: true,
  });

  readonly apiTask = new HTTPTask(this, 'apiTask', {
    name: 'api',
    // len = 14 + 4 = 18
    prefix: `${this.prefix}-api`,
    ipv6interfaceIdPrefix: 10,

    repo: this.apiRepo,
    image: this.apiImage,
    healthcheckPath: '/healthz',

    env: {
      API_BASE_PATH: '',
      // TODO(security): SecretsManager
      DATABASE_URL: z.string().parse(this.dbURL.value),
      S3_BUCKET: z.string().parse(this.s3.bucket),
      S3_REGION: this.s3.region,
    },
  });

  readonly operateEnvRole = new IAM.DataAwsIamRole(this, 'operateEnvRole', {
    name: this.options.codeBuildStackEnv.SCRIPT_ROLE_NAME,
  });

  readonly allowRunApiTaskRolePolicy = new IAM.IamRolePolicy(this, 'allowRunApiTaskRolePolicy', {
    name: this.prefix,
    role: this.operateEnvRole.name,
    policy: this.apiTask.allowRunTaskPolicyDoc.json,
  });

  readonly webTask = new HTTPTask(this, 'webTask', {
    name: 'web',
    // len = 14 + 4 = 18
    prefix: `${this.prefix}-web`,
    ipv6interfaceIdPrefix: 20,

    repo: this.webRepo,
    image: this.webImage,
    healthcheckPath: '/',

    env: {
      API_BASE_PATH: '',
      API_ORIGIN: z.string().parse(this.apiTask.url),
    },
  });

  readonly opTfOutput: OpTfOutput = {
    apiTaskDefinitionArn: this.apiTask.definition.arn,
    apiURL: this.apiTask.url,
    webURL: this.webTask.url,
    envRegion: z.string().parse(this.aws.region),
    ecsClusterName: this.cluster.name,
    apiTaskLogGroupName: z.string().parse(this.apiTask.logGroup.name),
    webTaskLogGroupName: z.string().parse(this.webTask.logGroup.name),
  };

  readonly opOutputs = Object.entries(this.opTfOutput).map(
    ([key, value]) => new TerraformOutput(this, `opOutputs-${key}`, { value }),
  );
}
