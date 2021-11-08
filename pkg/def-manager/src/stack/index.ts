import * as path from 'path';
import { AwsProvider, ECR, ResourceGroups, Route53, S3 } from '@cdktf/provider-aws';
import { z } from 'zod';
import { NullProvider } from '@cdktf/provider-null';
import { RandomProvider, String as RandomString } from '@cdktf/provider-random';
import { projectRootDir, PROJECT_NAME } from '@self/shared/lib/const';
import type { DockerHubCred, ManagerEnv, SharedEnv } from '@self/shared/lib/def/env-vars';
import { Fn, TerraformHclModule, TerraformOutput, TerraformStack } from 'cdktf';
import type { Construct } from 'constructs';
import { ensurePath } from '@self/shared/lib/def/util/ensure-path';
import type { Section } from '@self/shared/lib/def/types';
import type { BuildDictContext, RepoDictContext } from './bot-attach';
import { BotAttach } from './bot-attach';
import { ContainerBuild } from './build-container';
import { createDictContext } from './context/dict';
import { DockerHubCredentials } from './dockerhub-credentials';
import { OperateEnv } from './operate-env';
import { UpdatePRLabels } from './update-pr-labels';
import { Bot } from './bot';

export interface VioletManagerOptions {
  region: string;
  sharedEnv: SharedEnv;
  managerEnv: ManagerEnv;

  dockerHubCred?: DockerHubCred | undefined;
}

export class VioletManagerStack extends TerraformStack {
  get uniqueName(): string {
    return `violet-manager-${
      this.options.sharedEnv.DEV_NAMESPACE ? `dev-${this.options.sharedEnv.DEV_NAMESPACE}` : 'prod'
    }-${this.options.region}`;
  }

  constructor(scope: Construct, name: string, public options: VioletManagerOptions) {
    super(scope, name);
  }

  private genTags(name: string | null, section?: Section | null): Record<string, string> {
    const tags: Record<string, string> = {
      Project: PROJECT_NAME,
      /** マネージャ層であることを示すフラグ */
      Manager: 'true',
      /** IaC で管理している、というフラグ */
      Managed: 'true',
    };
    if (name != null) tags.Name = name;
    if (section != null) tags.Section = section;
    if (this.options.sharedEnv.DEV_NAMESPACE) tags.Section = 'development';
    return tags;
  }

  readonly nullProvider = new NullProvider(this, 'nullProvider', {});

  readonly random = new RandomProvider(this, 'random', {});

  readonly awsProvider = new AwsProvider(this, 'awsProvider', {
    region: this.options.region,
    profile: process.env.AWS_PROFILE || undefined,
    defaultTags: {
      tags: this.genTags(null),
    },
  });

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  readonly buildDictContext: BuildDictContext = createDictContext();

  readonly repoDictContext: RepoDictContext = createDictContext();

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
      ...this.genTags('Project Violet Manager Resources'),
    },
  });

  readonly dockerHubCredentials =
    this.options.dockerHubCred &&
    new DockerHubCredentials(this, 'dockerHubCredentials', {
      dockerHubCred: this.options.dockerHubCred,
      prefix: 'violet',

      tagsAll: {
        ...this.genTags(null),
      },
    });

  readonly ssmPrefix = `/${PROJECT_NAME}-${this.suffix.result}`;

  readonly previewZone = new Route53.DataAwsRoute53Zone(this, 'previewZone', {
    zoneId: this.options.sharedEnv.PREVIEW_ZONE_ID,
  });

  readonly infraSourceBucket = new S3.S3Bucket(this, 'infraSourceBucket', {
    bucketPrefix: `vio-infra-source-`,
    acl: 'private',
    forceDestroy: true,
  });

  readonly infraSourceZipPath = ensurePath(path.resolve(projectRootDir, 'self.local.zip'));

  readonly infraSourceZip = new S3.S3BucketObject(this, 'infraSourceZip', {
    bucket: z.string().parse(this.infraSourceBucket.bucket),
    key: `source-${Fn.sha1(Fn.filebase64(this.infraSourceZipPath))}.zip`,
    source: this.infraSourceZipPath,
    acl: 'private',
    forceDestroy: true,
  });

  // === ECR Repositories ===
  // https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_Repository.html
  // 管理方針:
  //   Production と Staging + Preview で無効化方針が変わるため分ける
  //   TODO: Public Repository のほうがよいかもしれない

  readonly apiProdRepo = new ECR.EcrRepository(this, 'apiProdRepo', {
    name: `violet-api-prod-${this.suffix.result}`,
    imageTagMutability: 'IMMUTABLE',
    // TODO(security): for production
    // imageScanningConfiguration,
    tagsAll: {
      ...this.genTags(null, 'production'),
    },
  });

  readonly apiDevRepo = this.repoDictContext.add(
    'Api',
    new ECR.EcrRepository(this, 'apiDevRepo', {
      name: `violet-api-dev-${this.suffix.result}`,
      imageTagMutability: 'MUTABLE',
      tagsAll: {
        ...this.genTags(null, 'development'),
      },
    }),
  );

  readonly webProdRepo = new ECR.EcrRepository(this, 'webProdRepo', {
    name: `violet-web-prod-${this.suffix.result}`,
    imageTagMutability: 'IMMUTABLE',
    // TODO(security): for production
    // imageScanningConfiguration,
    tagsAll: {
      ...this.genTags(null, 'production'),
    },
  });

  readonly webDevRepo = this.repoDictContext.add(
    'Web',
    new ECR.EcrRepository(this, 'webDevRepo', {
      name: `violet-web-dev-${this.suffix.result}`,
      imageTagMutability: 'MUTABLE',
      tagsAll: {
        ...this.genTags(null, 'development'),
      },
    }),
  );

  readonly lambdaProdRepo = new ECR.EcrRepository(this, 'lambdaProdRepo', {
    name: `violet-lam-prod-${this.suffix.result}`,
    imageTagMutability: 'IMMUTABLE',
    // TODO(security): for production
    // imageScanningConfiguration,
    tagsAll: {
      ...this.genTags(null, 'production'),
    },
  });

  readonly lambdaDevRepo = this.repoDictContext.add(
    'Lam',
    new ECR.EcrRepository(this, 'lambdaDevRepo', {
      name: `violet-lam-dev-${this.suffix.result}`,
      imageTagMutability: 'MUTABLE',
      tagsAll: {
        ...this.genTags(null, 'development'),
      },
    }),
  );

  readonly bot = new Bot(this, 'bot', {
    prefix: 'vio-bot',
    logsPrefix: `${this.logsPrefix}/bot`,
    ssmPrefix: `${this.logsPrefix}/bot`,

    infraSourceBucket: this.infraSourceBucket,
    infraSourceZip: this.infraSourceZip,
    previewZone: this.previewZone,

    tagsAll: {
      ...this.genTags(null),
    },
  });

  readonly apiBuild = new ContainerBuild(this, 'apiBuild', {
    name: 'Api',
    prefix: 'violet-dev-api-build',
    sharedEnv: this.options.sharedEnv,
    managerEnv: this.options.managerEnv,
    logsPrefix: `${this.logsPrefix}/dev-api-build`,
    repo: this.apiDevRepo,
    bot: this.bot,

    buildDictContext: this.buildDictContext,

    tagsAll: {
      ...this.genTags(null, 'development'),
    },
  });

  readonly webBuild = new ContainerBuild(this, 'webBuild', {
    name: 'Web',
    prefix: 'violet-dev-web-build',
    sharedEnv: this.options.sharedEnv,
    managerEnv: this.options.managerEnv,
    logsPrefix: `${this.logsPrefix}/dev-web-build`,
    repo: this.webDevRepo,
    bot: this.bot,

    buildDictContext: this.buildDictContext,

    tagsAll: {
      ...this.genTags(null, 'development'),
    },
  });

  readonly lambdaBuild = new ContainerBuild(this, 'lambdaBuild', {
    name: 'Lam',
    sharedEnv: this.options.sharedEnv,
    managerEnv: this.options.managerEnv,
    prefix: 'violet-dev-lam-build',
    logsPrefix: `${this.logsPrefix}/dev-lam-build`,
    repo: this.lambdaDevRepo,
    bot: this.bot,

    buildDictContext: this.buildDictContext,

    tagsAll: {
      ...this.genTags(null, 'development'),
    },
  });

  readonly operateEnv = new OperateEnv(this, 'operateEnv', {
    prefix: 'vio-d-ope',
    logsPrefix: `${this.logsPrefix}/dev-openv`,
    bot: this.bot,
    sharedEnv: this.options.sharedEnv,
    managerEnv: this.options.managerEnv,
    apiDevRepo: this.apiDevRepo,
    webDevRepo: this.webDevRepo,
    infraSourceBucket: this.infraSourceBucket,
    infraSourceZip: this.infraSourceZip,

    buildDictContext: this.buildDictContext,

    tagsAll: {
      ...this.genTags(null, 'development'),
    },
  });

  readonly updatePRLabels = new UpdatePRLabels(this, 'updatePRLabels', {
    prefix: 'vio-d-upla',
    logsPrefix: `${this.logsPrefix}/dev-openv`,
    bot: this.bot,
    sharedEnv: this.options.sharedEnv,
    managerEnv: this.options.managerEnv,
    infraSourceBucket: this.infraSourceBucket,
    infraSourceZip: this.infraSourceZip,

    buildDictContext: this.buildDictContext,

    tagsAll: {
      ...this.genTags(null, 'development'),
    },
  });

  // NOTE: buildDictContext is consumed
  // NOTE: repoDictContext is consumed
  readonly botAttach = new BotAttach(this, 'botAttach', {
    prefix: 'vio-bot-a',
    bot: this.bot,

    buildDictContext: this.buildDictContext,
    repoDictContext: this.repoDictContext,

    tagsAll: {
      ...this.genTags(null),
    },
  });

  readonly botApiEndpoint = new TerraformOutput(this, 'botWebhookEndpoint', {
    value: this.bot.webhookEndpoint,
  });

  /**
   * ローカルで bot をサーブする場合は、 <project>/pkg/bot/.env.local に追記する
   */
  readonly botEnvFile = new TerraformOutput(this, 'botEnvFile', {
    value: Object.entries({
      ...this.bot.computedBotEnv,
      ...this.botAttach.computedAfterwardBotEnv,
    })
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  });

  readonly opEnvFile = new TerraformOutput(this, 'opEnvFile', {
    value: Object.entries(this.operateEnv.computedOpEnv)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  });

  readonly previewZoneCertificate = new TerraformHclModule(this, 'previewZoneCertificate', {
    source: 'cloudposse/acm-request-certificate/aws',
    version: '~>0.15.1',
    variables: {
      domain_name: this.previewZone.name,
      process_domain_validation_options: true,
      ttl: '5',
      subject_alternative_names: [`*.${this.previewZone.name}`],
    },
  });
}
