import * as path from 'path';
import { AwsProvider, ResourceGroups, Route53, S3 } from '@cdktf/provider-aws';
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
import { RepoStack } from './repo-stack';

export interface VioletManagerOptions {
  region: string;
  sharedEnv: SharedEnv;
  managerEnv: ManagerEnv;

  dockerHubCred?: DockerHubCred | undefined;
}

export class VioletManagerStack extends TerraformStack {
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
    if (this.options.sharedEnv.MANAGER_NAMEPACE !== 'prod') tags.Section = 'development';
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

  readonly apiRepo = new RepoStack(this, 'apiRepo', {
    prefix: 'vio',
    name: 'Api',
    tagsAll: {
      ...this.genTags(null),
    },
    devRepoDictContext: this.repoDictContext,
  });

  readonly webRepo = new RepoStack(this, 'webRepo', {
    prefix: 'vio',
    name: 'Web',
    tagsAll: {
      ...this.genTags(null),
    },
    devRepoDictContext: this.repoDictContext,
  });

  readonly lambdaConv2imgRepo = new RepoStack(this, 'lambdaConv2imgRepo', {
    prefix: 'vio',
    name: 'LamC2i',
    tagsAll: {
      ...this.genTags(null),
    },
    devRepoDictContext: this.repoDictContext,
  });

  readonly lambdaApiexecRepo = new RepoStack(this, 'lambdaApiexecRepo', {
    prefix: 'vio',
    name: 'LamAe',
    tagsAll: {
      ...this.genTags(null),
    },
    devRepoDictContext: this.repoDictContext,
  });

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
    prefix: 'vio-d-api-bui',
    sharedEnv: this.options.sharedEnv,
    managerEnv: this.options.managerEnv,
    logsPrefix: `${this.logsPrefix}/dev-api-build`,
    repo: this.apiRepo.devRepo,
    bot: this.bot,

    buildDictContext: this.buildDictContext,

    tagsAll: {
      ...this.genTags(null, 'development'),
    },
  });

  readonly webBuild = new ContainerBuild(this, 'webBuild', {
    name: 'Web',
    prefix: 'vio-d-web-bui',
    sharedEnv: this.options.sharedEnv,
    managerEnv: this.options.managerEnv,
    logsPrefix: `${this.logsPrefix}/dev-web-build`,
    repo: this.webRepo.devRepo,
    bot: this.bot,

    buildDictContext: this.buildDictContext,

    tagsAll: {
      ...this.genTags(null, 'development'),
    },
  });

  readonly lambdaConv2imgBuild = new ContainerBuild(this, 'lambdaConv2imgBuild', {
    name: 'LamC2i',
    sharedEnv: this.options.sharedEnv,
    managerEnv: this.options.managerEnv,
    prefix: 'vio-d-lamc2i-bui',
    logsPrefix: `${this.logsPrefix}/dev-lam-build`,
    repo: this.lambdaConv2imgRepo.devRepo,
    bot: this.bot,

    buildDictContext: this.buildDictContext,

    tagsAll: {
      ...this.genTags(null, 'development'),
    },
  });

  readonly lambdaApiexecBuild = new ContainerBuild(this, 'lambdaApiexecBuild', {
    name: 'LamAe',
    sharedEnv: this.options.sharedEnv,
    managerEnv: this.options.managerEnv,
    prefix: 'vio-d-lamae-bui',
    logsPrefix: `${this.logsPrefix}/dev-lam-build`,
    repo: this.lambdaApiexecRepo.devRepo,
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
    apiRepo: this.apiRepo,
    webRepo: this.webRepo,
    lambdaConv2imgRepo: this.lambdaConv2imgRepo,
    lambdaApiexecRepo: this.lambdaApiexecRepo,
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
    sharedEnv: this.options.sharedEnv,

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
  readonly localEnvFile = new TerraformOutput(this, 'localEnvFile', {
    value: Object.entries({
      ...this.bot.computedBotEnv,
      ...this.bot.computedBotEnv,
      ...this.botAttach.computedAfterwardBotEnv,
      ...this.operateEnv.computedOpEnv,
    })
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
