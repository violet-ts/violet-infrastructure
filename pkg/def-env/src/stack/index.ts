import { AwsProvider, ResourceGroups, S3, Route53, ECS, ECR, ACM } from '@cdktf/provider-aws';
import { NullProvider } from '@cdktf/provider-null';
import { RandomProvider, String as RandomString } from '@cdktf/provider-random';
import { TerraformOutput, TerraformStack } from 'cdktf';
import type { Construct } from 'constructs';
import type { ComputedOpEnv, DynamicOpEnv } from '@self/shared/lib/operate-env/op-env';
import type { SharedEnv } from '@self/shared/lib/def/env-vars';
import { PROJECT_NAME } from '@self/shared/lib/const';
import type { Section } from '@self/shared/lib/def/types';
import { z } from 'zod';
import { ApiTask } from './api-task';
import { MysqlDb } from './mysql';
import { genTags } from './values';
import { DataNetwork } from './data-network';

export interface VioletEnvOptions {
  region: string;
  section: Section;

  sharedEnv: SharedEnv;
  dynamicOpEnv: DynamicOpEnv;
  computedOpEnv: ComputedOpEnv;
}

export class VioletEnvStack extends TerraformStack {
  get uniqueName(): string {
    return `env-${this.options.region}-${this.options.dynamicOpEnv.NAMESPACE}-${this.options.section}`;
  }

  private readonly nsPattern = /[a-zA-Z-]+/;

  constructor(scope: Construct, name: string, public options: VioletEnvOptions) {
    super(scope, name);

    if (!options.dynamicOpEnv.NAMESPACE.match(this.nsPattern)) {
      throw new Error(`Namespace option should satisfy ${this.nsPattern}: got ${options.dynamicOpEnv.NAMESPACE}`);
    }
  }

  private readonly prefix = `violet-e-${this.options.dynamicOpEnv.NAMESPACE}-${this.options.section[0]}`;

  readonly nullProvider = new NullProvider(this, 'nullProvider', {});

  readonly random = new RandomProvider(this, 'random', {});

  readonly aws = new AwsProvider(this, 'aws', {
    region: this.options.region,
    profile: this.options.sharedEnv.AWS_PROFILE,
    defaultTags: {
      tags: genTags(null, this.options.dynamicOpEnv.NAMESPACE, this.options.section),
    },
  });

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  readonly apiRepo = new ECR.DataAwsEcrRepository(this, 'apiRepo', {
    name: this.options.computedOpEnv.API_REPO_NAME,
  });

  readonly apiImage = new ECR.DataAwsEcrImage(this, 'apiImage', {
    repositoryName: this.apiRepo.name,
    // TODO(hardcoded)
    imageDigest: this.options.dynamicOpEnv.API_REPO_SHA,
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
    name: `${this.prefix}-${this.suffix.result}`,
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
    prefix: `${this.prefix}-mysql`,
    subnets: this.network.publicSubnets,
    vpcSecurityGroups: [this.network.dbSg],
  });

  // DB URL for prisma schema
  readonly dbURL = new TerraformOutput(this, 'dbURL', {
    value: this.mysql.dbURL,
    sensitive: true,
  });

  // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Cluster.html
  readonly cluster = new ECS.EcsCluster(this, 'cluster', {
    name: `${this.prefix}-${this.suffix.result}`,
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
    bucket: `${this.prefix}-${this.suffix.result}`,
    forceDestroy: true,
  });

  readonly apiTask = new ApiTask(this, 'apiTask', {
    prefix: `${this.prefix}-api`,
    ipv6interfaceIdPrefix: 10,
  });
}
