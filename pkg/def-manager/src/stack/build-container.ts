import type { ECR } from '@cdktf/provider-aws';
import { S3, CloudWatch, SNS, IAM, CodeBuild, CodeStar } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import * as z from 'zod';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import * as path from 'path';
import { ensurePath } from '@self/shared/lib/def/util/ensure-path';
import { computedBuildCodeBuildEnv } from '@self/shared/lib/build-env';
import type { VioletManagerStack } from '.';
import { dataDir } from './values';

export interface ContainerBuildOptions {
  repo: ECR.EcrRepository;
  tagsAll: Record<string, string>;
  prefix: string;
  logsPrefix: string;
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

  // TODO
  readonly cachename = `${this.options.prefix}-cache`;

  // TODO(cost): lifecycle
  readonly cache = new S3.S3Bucket(this, 'cache', {
    // TODO
    bucket: this.cachename,
    // bucket: `${this.options.prefix}-cache-${this.suffix.result}`,
    acl: 'private',
    forceDestroy: true,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly roleAssumeDocument = new IAM.DataAwsIamPolicyDocument(this, 'roleAssumeDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        principals: [
          {
            type: 'Service',
            identifiers: ['codebuild.amazonaws.com'],
          },
        ],
        actions: ['sts:AssumeRole'],
      },
    ],
  });

  readonly role = new IAM.IamRole(this, 'role', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    assumeRolePolicy: this.roleAssumeDocument.json,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly dockerHubPolicyAttach =
    this.parent.dockerHubCredentials &&
    new IAM.IamPolicyAttachment(this, 'dockerHubPolicyAttach', {
      name: `${this.options.prefix}-${this.suffix.result}`,
      policyArn: this.parent.dockerHubCredentials.policy.arn,
      roles: [this.role.id],
    });

  readonly buildLogGroup = new CloudWatch.CloudwatchLogGroup(this, 'buildLogGroup', {
    namePrefix: `${this.options.logsPrefix}/build`,
    retentionInDays: 3,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_project
  // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html
  readonly build = new CodeBuild.CodebuildProject(this, 'build', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    concurrentBuildLimit: 3,
    environment: {
      // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-compute-types.html
      computeType: 'BUILD_GENERAL1_SMALL',
      type: 'LINUX_CONTAINER',
      // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
      image: 'aws/codebuild/standard:5.0',
      imagePullCredentialsType: 'CODEBUILD',
      privilegedMode: true,
      environmentVariable: [
        ...(this.parent.dockerHubCredentials?.codeBuildEnvironmentVariables ?? []),
        ...computedBuildCodeBuildEnv({
          AWS_ACCOUNT_ID: this.parent.options.sharedEnv.AWS_ACCOUNT_ID,
        }),
      ],
    },
    source: {
      type: 'NO_SOURCE',
      buildspec: `\${file("${ensurePath(path.resolve(dataDir, 'buildspecs', 'build-container.yml'))}")}`,
    },
    // NOTE: minutes
    buildTimeout: 20,
    serviceRole: this.role.arn,
    artifacts: {
      type: 'NO_ARTIFACTS',
    },
    cache: {
      // https://docs.aws.amazon.com/codebuild/latest/userguide/build-caching.html#caching-s3
      type: 'S3',
      location: this.cachename,
      // location: this.cache.arn,
    },
    logsConfig: {
      cloudwatchLogs: {
        groupName: this.buildLogGroup.name,
      },
    },

    tagsAll: {
      ...this.options.tagsAll,
    },

    dependsOn: [this.cache],
  });

  readonly policyDocument = new IAM.DataAwsIamPolicyDocument(this, 'policyDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        resources: [`${this.buildLogGroup.arn}:*`],
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      },
      {
        effect: 'Allow',
        resources: [this.cache.arn, `${this.cache.arn}/*`],
        actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetObject', 's3:GetObjectAcl', 's3:DeleteObject'],
      },
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

  readonly rolePolicy = new IAM.IamRolePolicy(this, 'rolePolicy', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    role: z.string().parse(this.role.name),
    policy: this.policyDocument.json,
  });

  readonly topic = new SNS.SnsTopic(this, 'topic', {
    name: `${this.options.prefix}-${this.suffix.result}`,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // CodeStar Notification に SNS Topic への publish を許可するポリシー
  readonly topicPolicyDoc = new IAM.DataAwsIamPolicyDocument(this, 'topicPolicyDoc', {
    statement: [
      {
        actions: ['sns:Publish'],
        principals: [
          {
            type: 'Service',
            identifiers: ['codestar-notifications.amazonaws.com'],
          },
        ],
        resources: [this.topic.arn],
      },
    ],
  });

  readonly topicPolicy = new SNS.SnsTopicPolicy(this, 'topicPolicy', {
    arn: this.topic.arn,
    policy: this.topicPolicyDoc.json,
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codestarnotifications_notification_rule
  readonly notification = new CodeStar.CodestarnotificationsNotificationRule(this, 'notification', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    resource: this.build.arn,
    detailType: 'BASIC',
    // https://docs.aws.amazon.com/ja_jp/dtconsole/latest/userguide/concepts.html#concepts-api
    eventTypeIds: [
      'codebuild-project-build-state-failed',
      'codebuild-project-build-state-succeeded',
      'codebuild-project-build-state-in-progress',
      'codebuild-project-build-state-stopped',
    ],
    target: [
      {
        type: 'SNS',
        address: this.topic.arn,
      },
    ],

    tagsAll: {
      ...this.options.tagsAll,
    },
  });
}
