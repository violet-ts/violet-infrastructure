import type { ecr } from '@cdktf/provider-aws';
import { iam } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null/lib/resource';
import { Resource } from '@cdktf/provider-null/lib/resource';
import { StringResource as RandomString } from '@cdktf/provider-random';
import type { ManagerEnv, SharedEnv } from '@self/shared/lib/def/env-vars';
import type { CodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import { z } from 'zod';
import type { VioletManagerStack } from '.';
import type { Bot, BuildDictContext } from './bot';
import { CodeBuildStack } from './codebuild-stack';

export interface ContainerBuildOptions {
  name: string;
  sharedEnv: SharedEnv;
  managerEnv: ManagerEnv;
  repo: ecr.EcrRepository;
  tagsAll: Record<string, string>;
  prefix: string;
  logsPrefix: string;
  environmentVariable?: CodeBuildEnv | undefined;
  bot: Bot;

  buildDictContext: BuildDictContext;
}

/**
 * Docker イメージをビルドして ECR に push するまでを行う CodeBuild Project とその周辺
 * NOTE(security):
 *   Development と Production は config で判別し、権限の空間は完全に分ける。
 *   これは、攻撃的な PR をベースに CodeBuild が実行された場合でも安全である
 *   ようにするため。絶妙なタイミングで PR を更新するなどが考えられる。
 */
export class ContainerBuild extends Resource {
  constructor(
    public parent: VioletManagerStack,
    name: string,
    public options: ContainerBuildOptions,
    config?: ResourceConfig,
  ) {
    super(parent, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  readonly buildStack = this.options.buildDictContext.add(
    this.options.name,
    new CodeBuildStack(this, 'buildStack', {
      sharedEnv: this.options.sharedEnv,
      managerEnv: this.options.managerEnv,
      buildSpecName: 'build-container.yml',
      prefix: `${this.options.prefix}-bs`,
      logsPrefix: this.options.logsPrefix,
      bot: this.options.bot,
      environmentVariable: [
        ...(this.parent.dockerHubCredentials?.codeBuildEnvironmentVariables ?? []),
        ...(this.options.environmentVariable ?? []),
      ],

      tagsAll: {
        ...this.options.tagsAll,
      },
    }),
  );

  readonly dockerHubPolicy =
    this.parent.dockerHubCredentials &&
    new iam.IamRolePolicy(this, 'dockerHubPolicy', {
      namePrefix: `${this.options.prefix}-dcred`,
      policy: this.parent.dockerHubCredentials.policyDocument.json,
      role: this.buildStack.role.id,
    });

  readonly policyDocument = new iam.DataAwsIamPolicyDocument(this, 'policyDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      },
      {
        effect: 'Allow',
        resources: [this.options.repo.arn],
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:CompleteLayerUpload',
          'ecr:InitiateLayerUpload',
          'ecr:PutImage',
          'ecr:UploadLayerPart',
        ],
      },
    ],
  });

  readonly rolePolicy = new iam.IamRolePolicy(this, 'rolePolicy', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    role: z.string().parse(this.buildStack.role.name),
    policy: this.policyDocument.json,
  });
}
