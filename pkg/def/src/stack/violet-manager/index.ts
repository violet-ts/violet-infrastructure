import { AwsProvider, ECR, ResourceGroups } from '@cdktf/provider-aws';
import { NullProvider } from '@cdktf/provider-null';
import { RandomProvider, String as RandomString } from '@cdktf/provider-random';
import { TerraformOutput, TerraformStack } from 'cdktf';
import type { Construct } from 'constructs';
import type { DevEnv, ProdEnv, SharedEnv } from '../../app/env-vars';
import { PROJECT_NAME } from '../../const';
import { Bot } from './bot';
import { ApiBuild } from './build-api';
import { DockerHubCredentials } from './dockerhub-credentials';
import { EnvDeploy } from './env-deploy';
import { genTags } from './values';

export interface VioletManagerOptions {
  region: string;
  sharedEnv: SharedEnv;
  devEnv: DevEnv;
  prodEnv: ProdEnv;
}

export class VioletManagerStack extends TerraformStack {
  get uniqueName(): string {
    return `manager-${this.options.region}`;
  }

  constructor(scope: Construct, name: string, public options: VioletManagerOptions) {
    super(scope, name);
  }

  readonly nullProvider = new NullProvider(this, 'nullProvider', {});

  readonly random = new RandomProvider(this, 'random', {});

  readonly awsProvider = new AwsProvider(this, 'awsProvider', {
    region: this.options.region,
    profile: this.options.sharedEnv.AWS_PROFILE,
    defaultTags: {
      tags: genTags(null),
    },
  });

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  readonly logsPrefix = `/violet/${this.suffix.result}`;

  // Violet プロジェクトすべてのリソース
  readonly allResources = new ResourceGroups.ResourcegroupsGroup(this, 'allResources', {
    name: `violet-all`,
    resourceQuery: {
      query: JSON.stringify({
        ResourceTypeFilters: ['AWS::AllSupported'],
        TagFilters: [
          {
            Key: 'Project',
            Values: [PROJECT_NAME],
          },
        ],
      }),
    },
  });

  // Violet Manager のリソース
  readonly managerResources = new ResourceGroups.ResourcegroupsGroup(this, 'managerResources', {
    name: `violet-manager`,
    resourceQuery: {
      query: JSON.stringify({
        ResourceTypeFilters: ['AWS::AllSupported'],
        TagFilters: [
          {
            Key: 'Project',
            Values: [PROJECT_NAME],
          },
          {
            Key: 'Manager',
            Values: ['true'],
          },
        ],
      }),
    },
    tagsAll: {
      ...genTags('Project Violet Manager Resources'),
    },
  });

  readonly dockerHubCredentials = (() => {
    const { DOCKERHUB } = this.options.sharedEnv;
    if (DOCKERHUB == null) return null;
    return new DockerHubCredentials(this, 'dockerHubCredentials', {
      DOCKERHUB,
      prefix: 'violet',

      tagsAll: {
        ...genTags(null),
      },
    });
  })();

  readonly ssmPrefix = `/${PROJECT_NAME}-${this.suffix.result}`;

  // === ECR Repositories ===
  // https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_Repository.html
  // 管理方針:
  //   Production と Staging + Preview で無効化方針が変わるため分ける
  //   TODO: Public Repository のほうがよいかもしれない

  readonly apiProdRepo = new ECR.EcrRepository(this, 'apiProdRepo', {
    name: this.options.prodEnv.ECR_API_PROD_NAME,
    imageTagMutability: 'IMMUTABLE',
    // TODO(security): for production
    // imageScanningConfiguration,
    tagsAll: {
      ...genTags(null, 'production'),
    },
  });

  readonly apiDevRepo = new ECR.EcrRepository(this, 'apiDevRepo', {
    name: this.options.devEnv.ECR_API_DEV_NAME,
    imageTagMutability: 'MUTABLE',
    // TODO(security): for production
    // imageScanningConfiguration,
    tagsAll: {
      ...genTags(null, 'development'),
    },
  });

  // ===

  readonly devApiBuild = new ApiBuild(this, 'devApiBuild', {
    prefix: 'violet-dev-api-build',
    logsPrefix: `${this.logsPrefix}/dev-api-build`,
    ecr: this.apiDevRepo,

    tagsAll: {
      ...genTags(null, 'development'),
    },
  });

  readonly devEnvDeploy = new EnvDeploy(this, 'devEnvDeploy', {
    prefix: 'violet-dev-env-deploy',
    logsPrefix: `${this.logsPrefix}/dev-env-deploy`,

    tagsAll: {
      ...genTags(null, 'development'),
    },
  });

  readonly bot = new Bot(this, 'bot', {
    prefix: 'violet-bot',
    devApiBuild: this.devApiBuild,
    ssmPrefix: `${this.ssmPrefix}/bot`,
    logsPrefix: `${this.logsPrefix}/bot`,

    tagsAll: {
      ...genTags(null),
    },
  });

  readonly botApiEndpoint = new TerraformOutput(this, 'botWebhookEndpoint', {
    value: this.bot.webhookEndpoint,
  });

  /**
   * ローカルで bot をサーブする場合は、 <project>/pkg/bot/.env.local に追記する
   */
  readonly botEnvFile = new TerraformOutput(this, 'botEnvFile', {
    value: [
      `SSM_PREFIX=${this.bot.options.ssmPrefix}`,
      `API_BUILD_PROJECT_NAME=${this.devApiBuild.build.name}`,
      `TABLE_NAME=${this.bot.table.name}`,
    ]
      .map((e) => `${e}\n`)
      .join(''),
  });
}
