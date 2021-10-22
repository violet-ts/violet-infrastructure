import { AwsProvider, EcrRepository, ResourcegroupsGroup, SsmParameter } from '@cdktf/provider-aws';
import { NullProvider } from '@cdktf/provider-null';
import { RandomProvider, String as RandomString } from '@cdktf/provider-random';
import { TerraformOutput, TerraformStack } from 'cdktf';
import type { Construct } from 'constructs';
import type { DevEnv, ProdEnv, SharedEnv } from '../../app/env-vars';
import { PROJECT_NAME } from '../../const';
import { Bot } from './bot';
import { ApiBuild } from './build-api';
import { DockerHubCredentials } from './dockerhub-credentials';
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

  // =================================================================
  // Null Provider
  // =================================================================
  readonly nullProvider = new NullProvider(this, 'nullProvider', {});

  // =================================================================
  // Random Provider
  // https://registry.terraform.io/providers/hashicorp/random/latest
  // =================================================================
  readonly random = new RandomProvider(this, 'random', {});

  // =================================================================
  // Random Suffix
  // https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/string
  // =================================================================
  readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  // =================================================================
  // AWS Provider
  // =================================================================
  readonly awsProvider = new AwsProvider(this, 'aws', {
    region: this.options.region,
    profile: this.options.sharedEnv.AWS_PROFILE,
  });

  // =================================================================
  // Resource Groups
  // -----------------------------------------------------------------
  // Violet プロジェクトすべてのリソース
  // =================================================================
  readonly allResources = new ResourcegroupsGroup(this, 'allResources', {
    name: `violet-all`,
    resourceQuery: [
      {
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
    ],
    tags: genTags('Project Violet All Resources'),
  });

  // =================================================================
  // Resource Groups
  // -----------------------------------------------------------------
  // Violet Manager のリソース
  // =================================================================
  readonly managerResources = new ResourcegroupsGroup(this, 'managerResources', {
    name: `violet-manager`,
    resourceQuery: [
      {
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
    ],
    tags: genTags('Project Violet Manager Resources'),
  });

  readonly dockerHubCredentials = (() => {
    const { DOCKERHUB } = this.options.sharedEnv;
    if (DOCKERHUB == null) return null;
    return new DockerHubCredentials(this, 'dockerHubCredentials', { DOCKERHUB });
  })();

  readonly ssmPrefix = `/${PROJECT_NAME}-${this.suffix.result}`;

  readonly ssmBotPrefix = `${this.ssmPrefix}/bot`;

  readonly botParameters = botEnv.map(
    ([key, value]) =>
      new SsmParameter(this, `botParameters-${key}`, {
        name: `${this.ssmBotPrefix}/${key}`,
        value,
        type: 'SecureString',
        tags: genTags(null),
      }),
  );

  // =================================================================
  // ECS Repositories
  // https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_Repository.html
  // -----------------------------------------------------------------
  // 管理方針
  // Production と Staging + Preview で無効化方針が変わるため分ける
  // TODO: Public Repository のほうがよいかもしれない
  // =================================================================

  // -----------------------------------------------------------------
  // ECS Repository - Production API
  // -----------------------------------------------------------------
  readonly ecrProdApi = new EcrRepository(this, 'ecrProdApi', {
    name: this.options.prodEnv.ECR_API_PROD_NAME,
    imageTagMutability: 'IMMUTABLE',
    // TODO(security): for production
    // imageScanningConfiguration,
    tags: genTags(null, 'production'),
  });

  // -----------------------------------------------------------------
  // ECS Repository - Development API
  // -----------------------------------------------------------------
  readonly ecrDevApi = new EcrRepository(this, 'ecrDevApi', {
    name: this.options.devEnv.ECR_API_DEV_NAME,
    imageTagMutability: 'MUTABLE',
    // TODO(security): for production
    // imageScanningConfiguration,
    tags: genTags(null, 'development'),
  });

  readonly devApiBuild = new ApiBuild(this, 'devApiBuild', {
    prefix: 'violet-dev-api-build',
    ecr: this.ecrDevApi,
    tags: genTags(null, 'development'),
  });

  readonly bot = new Bot(this, 'bot', {
    prefix: 'violet-bot',
    devApiBuild: this.devApiBuild,
    ssmBotPrefix: this.ssmBotPrefix,
    botParameters: this.botParameters,
    tags: genTags(null, 'manage-only'),
  });

  // =================================================================
  // Outputs
  // =================================================================

  readonly botApiEndpoint = new TerraformOutput(this, 'botApiEndpoint', {
    value: this.bot.botApi.apiEndpoint,
  });

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
