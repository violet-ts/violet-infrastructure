import { AwsProvider, ECR, ResourceGroups, SSM } from '@cdktf/provider-aws';
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
import { botEnv, genTags } from './values';

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
  });

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

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
    tags: {
      ...genTags('Project Violet All Resources'),
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
    tags: {
      ...genTags('Project Violet Manager Resources'),
    },
  });

  readonly dockerHubCredentials = (() => {
    const { DOCKERHUB } = this.options.sharedEnv;
    if (DOCKERHUB == null) return null;
    return new DockerHubCredentials(this, 'dockerHubCredentials', {
      DOCKERHUB,
      prefix: 'violet',
      tags: {
        ...genTags(null),
      },
    });
  })();

  readonly ssmPrefix = `/${PROJECT_NAME}-${this.suffix.result}`;

  readonly ssmBotPrefix = `${this.ssmPrefix}/bot`;

  readonly botParameters = botEnv.map(
    ([key, value]) =>
      new SSM.SsmParameter(this, `botParameters-${key}`, {
        name: `${this.ssmBotPrefix}/${key}`,
        value,
        type: 'SecureString',
        tags: {
          ...genTags(null),
        },
      }),
  );

  // === ECR Repositories ===
  // https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_Repository.html
  // 管理方針:
  //   Production と Staging + Preview で無効化方針が変わるため分ける
  //   TODO: Public Repository のほうがよいかもしれない

  readonly ecrProdApi = new ECR.EcrRepository(this, 'ecrProdApi', {
    name: this.options.prodEnv.ECR_API_PROD_NAME,
    imageTagMutability: 'IMMUTABLE',
    // TODO(security): for production
    // imageScanningConfiguration,
    tags: {
      ...genTags(null, 'production'),
    },
  });

  readonly ecrDevApi = new ECR.EcrRepository(this, 'ecrDevApi', {
    name: this.options.devEnv.ECR_API_DEV_NAME,
    imageTagMutability: 'MUTABLE',
    // TODO(security): for production
    // imageScanningConfiguration,
    tags: {
      ...genTags(null, 'development'),
    },
  });

  // ===

  readonly devApiBuild = new ApiBuild(this, 'devApiBuild', {
    prefix: 'violet-dev-api-build',
    ecr: this.ecrDevApi,
    tags: {
      ...genTags(null, 'development'),
    },
  });

  readonly devEnvDeploy = new EnvDeploy(this, 'devEnvDeploy', {
    prefix: 'violet-dev-env-deploy',
    tags: {
      ...genTags(null, 'development'),
    },
  });

  readonly bot = new Bot(this, 'bot', {
    prefix: 'violet-bot',
    devApiBuild: this.devApiBuild,
    ssmBotPrefix: this.ssmBotPrefix,
    botParameters: this.botParameters,
    tags: {
      ...genTags(null),
    },
  });

  readonly botApiEndpoint = new TerraformOutput(this, 'botApiEndpoint', {
    value: this.bot.botApi.apiEndpoint,
  });

  /**
   * ローカルで bot をサーブする場合は、 <project>/pkg/bot/.env.local に追記する
   */
  readonly botEnvFile = new TerraformOutput(this, 'botEnvFile', {
    value: [
      `SSM_PREFIX=${this.ssmBotPrefix}`,
      `API_BUILD_PROJECT_NAME=${this.devApiBuild.build.name}`,
      `TABLE_NAME=${this.bot.table.name}`,
    ]
      .map((e) => `${e}\n`)
      .join(''),
  });
}
