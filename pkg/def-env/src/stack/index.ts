import { acm, AwsProvider, ecs, iam, resourcegroups, route53, sns } from '@cdktf/provider-aws';
import { NullProvider } from '@cdktf/provider-null/lib/provider';
import { RandomProvider } from '@cdktf/provider-random';
import type { ComputedBotEnv } from '@self/shared/lib/bot/env';
import type { CodeBuildStackEnv } from '@self/shared/lib/codebuild-stack/env';
import { PROJECT_NAME } from '@self/shared/lib/const';
import type { SharedEnv } from '@self/shared/lib/def/env-vars';
import type { Section } from '@self/shared/lib/def/types';
import type { ComputedOpEnv, DynamicOpEnv } from '@self/shared/lib/operate-env/op-env';
import type { OpTfOutput } from '@self/shared/lib/operate-env/output';
import type { ComputedRunScriptEnv, DynamicRunScriptEnv } from '@self/shared/lib/run-script/env';
import { getHash6 } from '@self/shared/lib/util/string';
import { TerraformLocal, TerraformOutput, TerraformStack } from 'cdktf';
import type { Construct } from 'constructs';
import { z } from 'zod';
import { APIExecFunction } from './api-exec-function';
import { Conv2imgFunction } from './conv2img-function';
import { DataNetwork } from './data-network';
import { HTTPTask } from './http-task';
import { MainDashboard } from './main-dashboard';
import { MysqlDb } from './mysql';
import { RepoImage } from './repo-image';
import { ServiceBuckets } from './service-buckets';

export interface VioletEnvOptions {
  region: string;
  section: Section;

  sharedEnv: SharedEnv;
  dynamicOpEnv: DynamicOpEnv;
  computedOpEnv: ComputedOpEnv;
  computedBotEnv: ComputedBotEnv;
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

  private genTags(name: string | null, namespace: string, section: Section): Record<string, string> {
    const tags: Record<string, string> = {
      Project: PROJECT_NAME,
      Namespace: namespace,
      NamespaceHash6: getHash6(namespace),
      Managed: 'true',
      ManagerNamespace: this.options.sharedEnv.MANAGER_NAMESPACE,
      Section: section,
    };
    if (name != null) tags.Name = name;
    return tags;
  }

  /** len = 6 + 6 + 1 + 1 = 14 */
  private readonly prefix = `vio-e-${getHash6(this.options.dynamicOpEnv.NAMESPACE)}-${this.options.section[0]}`;

  private readonly logsPrefix = `violet-env-${getHash6(this.options.dynamicOpEnv.NAMESPACE)}-${this.options.section}`;

  readonly nullProvider = new NullProvider(this, 'nullProvider', {});

  readonly random = new RandomProvider(this, 'random', {});

  readonly aws = new AwsProvider(this, 'aws', {
    region: this.options.region,
    profile: process.env.AWS_PROFILE || undefined,
    defaultTags: {
      tags: this.genTags(null, this.options.dynamicOpEnv.NAMESPACE, this.options.section),
    },
  });

  readonly awsProviderUsEast1 = new AwsProvider(this, 'awsProviderUsEast1', {
    region: 'us-east-1',
    alias: 'aws-us-east-1',
    profile: process.env.AWS_PROFILE || undefined,
    defaultTags: {
      tags: this.genTags(null, this.options.dynamicOpEnv.NAMESPACE, this.options.section),
    },
  });

  readonly apiRepoImage = new RepoImage(this, 'apiRepoImage', {
    aws: this.aws,
    sharedEnv: this.options.sharedEnv,
    repoName: this.options.computedOpEnv.API_REPO_NAME,
    imageDigest: this.options.dynamicOpEnv.API_REPO_SHA,
  });

  readonly webRepoImage = new RepoImage(this, 'webRepoImage', {
    aws: this.aws,
    sharedEnv: this.options.sharedEnv,
    repoName: this.options.computedOpEnv.WEB_REPO_NAME,
    imageDigest: this.options.dynamicOpEnv.WEB_REPO_SHA,
  });

  readonly lambdaConv2imgRepoImage = new RepoImage(this, 'lambdaConv2imgRepoImage', {
    aws: this.aws,
    sharedEnv: this.options.sharedEnv,
    repoName: this.options.computedOpEnv.LAMBDA_CONV2IMG_REPO_NAME,
    imageDigest: this.options.dynamicOpEnv.LAMBDA_CONV2IMG_REPO_SHA,
  });

  readonly lambdaApiexecRepoImage = new RepoImage(this, 'lambdaApiexecRepoImage', {
    aws: this.aws,
    sharedEnv: this.options.sharedEnv,
    repoName: this.options.computedOpEnv.LAMBDA_APIEXEC_REPO_NAME,
    imageDigest: this.options.dynamicOpEnv.LAMBDA_APIEXEC_REPO_SHA,
  });

  readonly zone = new route53.DataAwsRoute53Zone(this, 'zone', {
    zoneId: this.options.sharedEnv.PREVIEW_ZONE_ID,
  });

  readonly certificate = new acm.DataAwsAcmCertificate(this, 'certificate', {
    domain: this.zone.name,
  });

  readonly network = new DataNetwork(this, 'network');

  readonly botTopic = new sns.DataAwsSnsTopic(this, 'botTopic', {
    name: this.options.computedBotEnv.BOT_TOPIC_NAME,
  });

  // この namespace に属する Violet インフラを構築する、関連した
  // リソースの一覧
  readonly resourceGroups = new resourcegroups.ResourcegroupsGroup(this, 'resourceGroups', {
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
          {
            Key: 'ManagerNamespace',
            Values: [this.options.sharedEnv.MANAGER_NAMESPACE],
          },
        ],
      }),
    },
    tagsAll: {
      Name: `Violet Resources in ${this.options.dynamicOpEnv.NAMESPACE}`,
    },
  });

  readonly mysql = new MysqlDb(this, 'mysql', {
    subnets: this.network.publicSubnets,
    vpcSecurityGroups: [this.network.dbSg],
    computedOpEnv: this.options.computedOpEnv,
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
  readonly cluster = new ecs.EcsCluster(this, 'cluster', {
    name: this.prefix,
    capacityProviders: ['FARGATE'],
    // TODO(security): for production
    // imageScanningConfiguration,
  });

  readonly serviceBuckets = new ServiceBuckets(this, 'serviceBuckets', {
    computedOpEnv: this.options.computedOpEnv,
  });

  readonly apiEnv = {
    API_BASE_PATH: '',
    // TODO(security): SecretsManager
    DATABASE_URL: z.string().parse(this.dbURL.value),
    S3_REGION: z.string().parse(this.aws.region),
    S3_BUCKET_ORIGINAL: z.string().parse(this.serviceBuckets.originalBucket.bucket),
    S3_BUCKET_CONVERTED: z.string().parse(this.serviceBuckets.convertedBucket.bucket),
    // 認証の仕方が入ったファイル (Workload Identity Federation)
    // https://cloud.google.com/iam/docs/using-workload-identity-federation
    GCIP_CONFIG_JSON: this.options.computedBotEnv.GCIP_CONFIG_JSON,
    GCLOUD_PROJECT: this.options.computedBotEnv.GCIP_PROJECT,
  };

  readonly apiTask = new HTTPTask(this, 'apiTask', {
    name: 'api',
    // len = 14 + 4 = 18
    prefix: `${this.prefix}-api`,
    ipv6interfaceIdPrefix: 10,

    repoImage: this.apiRepoImage,
    healthcheckPath: '/healthz',
    computedOpEnv: this.options.computedOpEnv,

    env: this.apiEnv,
  });

  readonly apiServiceBucketsPolicy = new iam.IamRolePolicy(this, 'apiServiceBucketsPolicy', {
    // len = 14 + 8 = 22
    name: `${this.prefix}-buckets`,
    role: z.string().parse(this.apiTask.taskRole.name),
    policy: this.serviceBuckets.objectsFullAccessPolicyDocument.json,
  });

  readonly conv2imgFunction = new Conv2imgFunction(this, 'conv2imgFunction', {
    prefix: `${this.prefix}-c2i`,
    logsPrefix: `${this.logsPrefix}-lambda-conv2img`,
    task: this.apiTask,
    network: this.network,
    repoImage: this.lambdaConv2imgRepoImage,
    serviceBuckets: this.serviceBuckets,
    computedOpEnv: this.options.computedOpEnv,

    env: this.apiEnv,
  });

  readonly apiExecFunction = new APIExecFunction(this, 'apiExecFunction', {
    prefix: `${this.prefix}-apiexec`,
    task: this.apiTask,
    network: this.network,
    repoImage: this.lambdaApiexecRepoImage,
    serviceBuckets: this.serviceBuckets,
    computedOpEnv: this.options.computedOpEnv,

    env: this.apiEnv,
  });

  readonly operateEnvRole = new iam.DataAwsIamRole(this, 'operateEnvRole', {
    name: this.options.codeBuildStackEnv.SCRIPT_ROLE_NAME,
  });

  readonly allowRunApiTaskRolePolicy = new iam.IamRolePolicy(this, 'allowRunApiTaskRolePolicy', {
    name: this.prefix,
    role: this.operateEnvRole.name,
    policy: this.apiTask.allowRunTaskPolicyDoc.json,
  });

  readonly webTask = new HTTPTask(this, 'webTask', {
    name: 'web',
    // len = 14 + 4 = 18
    prefix: `${this.prefix}-web`,
    ipv6interfaceIdPrefix: 20,

    repoImage: this.webRepoImage,
    healthcheckPath: '/',
    computedOpEnv: this.options.computedOpEnv,

    env: {
      API_BASE_PATH: '',
      API_ORIGIN: z.string().parse(this.apiTask.url),
    },
  });

  readonly mainDashboard = new MainDashboard(this, 'mainDashboard', {
    serviceBuckets: this.serviceBuckets,
    serviceMysql: this.mysql,
    conv2imgFunction: this.conv2imgFunction,
    apiExecFunction: this.apiExecFunction,
    cluster: this.cluster,
    apiTask: this.apiTask,
    webTask: this.webTask,
    lambdaApiexecRepoImage: this.lambdaApiexecRepoImage,
    lambdaConv2imgRepoImage: this.lambdaConv2imgRepoImage,
    webRepoImage: this.webRepoImage,
    apiRepoImage: this.apiRepoImage,
    computedOpEnv: this.options.computedOpEnv,
  });

  readonly localEnvFile = new TerraformOutput(this, 'localEnvFile', {
    value: Object.entries({
      ...this.options.dynamicOpEnv,
      ...this.options.computedOpEnv,
      ...this.options.computedBotEnv,
      ...this.options.dynamicRunScriptEnv,
      ...this.options.computedRunScriptEnv,
      ...this.options.codeBuildStackEnv,
    })
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  });

  readonly opOutputValue: OpTfOutput = {
    resource_group_name: this.resourceGroups.name,
    api_task_definition_arn: this.apiTask.definition.arn,
    api_url: this.apiTask.url,
    web_url: this.webTask.url,
    env_region: z.string().parse(this.aws.region),
    ecs_cluster_name: this.cluster.name,
    api_task_log_group_name: z.string().parse(this.apiTask.logGroup.name),
    web_task_log_group_name: z.string().parse(this.webTask.logGroup.name),
    conv2img_function_name: z.string().parse(this.conv2imgFunction.function.functionName),
    api_exec_function_name: z.string().parse(this.apiExecFunction.function.functionName),
    original_bucket: z.string().parse(this.serviceBuckets.originalBucket.bucket),
    converted_bucket: z.string().parse(this.serviceBuckets.convertedBucket.bucket),
    main_dashboard_name: this.mainDashboard.dashboard.dashboardName,
  };

  readonly opOutput = new TerraformOutput(this, 'opOutput', {
    value: this.opOutputValue,
  });
}
