import type { ECR } from '@cdktf/provider-aws';
import { S3, SNS, IAM, CodeBuild, CodeStar } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import * as z from 'zod';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import * as path from 'path';
import type { VioletManagerStack } from '.';
import { ensurePath } from '../../util/ensure-path';
import { defRootDir } from './values';

export interface ApiBuildOptions {
  ecr: ECR.EcrRepository;
  tags: Record<string, string>;
  prefix: string;
}

/**
 * API をビルドして ECR に push するまでを行う CodeBuild Project とその周辺
 * NOTE(security):
 *   Development と Production は config で判別し、権限の空間は完全に分ける。
 *   これは、攻撃的な PR をベースに CodeBuild が実行された場合でも安全である
 *   ようにするため。絶妙なタイミングで PR を更新するなどが考えられる。
 */
export class ApiBuild extends Resource {
  constructor(
    public parent: VioletManagerStack,
    name: string,
    public options: ApiBuildOptions,
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
    tags: {
      ...this.options.tags,
    },
  });

  readonly role = new IAM.IamRole(this, 'role', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'codebuild.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    }),
    tags: {
      ...this.options.tags,
    },
  });

  readonly dockerHubRolePolicy =
    this.parent.dockerHubCredentials &&
    new IAM.IamRolePolicy(this, 'dockerHubRolePolicy', {
      name: `${this.options.prefix}-dockerhub-${this.suffix.result}`,
      role: z.string().parse(this.role.name),
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Resource: [this.parent.dockerHubCredentials.credentials.arn],
            Action: ['secretsmanager:GetSecretValue'],
          },
        ],
      }),
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
        {
          name: 'IMAGE_REPO_NAME',
          value: this.options.ecr.name,
        },
        {
          name: 'AWS_ACCOUNT_ID',
          value: this.parent.options.sharedEnv.AWS_ACCOUNT_ID,
        },
        {
          name: 'GIT_URL',
          // TODO(hardcoded)
          value: 'https://github.com/LumaKernel/violet.git',
        },
        {
          name: 'GIT_FETCH',
          value: 'master',
        },
        // GIT_URL
        // GIT_FETCH
        // IMAGE_TAG
      ],
    },
    source: {
      type: 'NO_SOURCE',
      buildspec: `\${file("${ensurePath(path.resolve(defRootDir, 'buildspecs', 'build-api.yml'))}")}`,
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

    // TODO(logging)
    tags: {
      ...this.options.tags,
    },
  });

  // NOTE(security): dev 環境の policy で誰でも任意コード実行と考えて設計する
  readonly rolePolicy = new IAM.IamRolePolicy(this, 'rolePolicy', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    role: z.string().parse(this.role.name),
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        // TODO(security): restrict
        {
          Effect: 'Allow',
          Resource: ['*'],
          Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        },
        {
          Effect: 'Allow',
          Resource: [this.cache.arn, `${this.cache.arn}/*`],
          Action: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetObject', 's3:GetObjectAcl', 's3:DeleteObject'],
        },
        {
          Action: ['ecr:GetAuthorizationToken'],
          Resource: ['*'],
          Effect: 'Allow',
        },
        {
          Action: [
            'ecr:BatchCheckLayerAvailability',
            'ecr:CompleteLayerUpload',
            'ecr:InitiateLayerUpload',
            'ecr:PutImage',
            'ecr:UploadLayerPart',
          ],
          Resource: [this.options.ecr.arn],
          Effect: 'Allow',
        },
        // TODO(security): restrict: needed?
        // {
        //   Effect: 'Allow',
        //   Action: [
        //     'ec2:CreateNetworkInterface',
        //     'ec2:DescribeDhcpOptions',
        //     'ec2:DescribeNetworkInterfaces',
        //     'ec2:DeleteNetworkInterface',
        //     'ec2:DescribeSubnets',
        //     'ec2:DescribeSecurityGroups',
        //     'ec2:DescribeVpcs',
        //   ],
        //   Resource: '*',
        // },
      ],
    }),
  });

  readonly topic = new SNS.SnsTopic(this, 'topic', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    tags: {
      ...this.options.tags,
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
    tags: {
      ...this.options.tags,
    },
  });
}
