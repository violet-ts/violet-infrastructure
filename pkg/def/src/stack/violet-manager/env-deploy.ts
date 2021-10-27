import { SNS, IAM, CodeBuild, CodeStar, S3 } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import * as path from 'path';
import * as z from 'zod';
import type { VioletManagerStack } from '.';
import { ensurePath } from '../../util/ensure-path';
import { defRootDir } from './values';

export interface ApiBuildOptions {
  tagsAll: Record<string, string>;
  prefix: string;
}

/**
 * 一つの環境を terraform で deploy/destroy するための CodeBuild Project とその関連
 */
export class EnvDeploy extends Resource {
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
  cachename = `${this.options.prefix}-cache`;

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

  readonly tfstate = new S3.S3Bucket(this, 'tfstate', {
    bucket: `${this.options.prefix}-tfstate-${this.suffix.result}`,
    acl: 'private',
    forceDestroy: true,
    tagsAll: {
      ...this.options.tagsAll,
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
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_project
  // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html
  readonly build = new CodeBuild.CodebuildProject(this, 'build', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    concurrentBuildLimit: 1,
    environment: {
      // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-compute-types.html
      computeType: 'BUILD_GENERAL1_SMALL',
      type: 'LINUX_CONTAINER',
      // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
      image: 'aws/codebuild/standard:5.0',
      imagePullCredentialsType: 'CODEBUILD',
      privilegedMode: true,
      environmentVariable: [
        {
          name: 'AWS_ACCOUNT_ID',
          value: this.parent.options.sharedEnv.AWS_ACCOUNT_ID,
        },
        {
          name: 'S3BACKEND_REGION',
          value: this.tfstate.region,
        },
        {
          name: 'S3BACKEND_BUCKET',
          value: z.string().parse(this.tfstate.bucket),
        },
        {
          name: 'GIT_URL_INFRA',
          value: 'https://github.com/violet-ts/violet-infrastructure.git',
        },
        {
          name: 'GIT_FETCH_INFRA',
          value: 'main',
        },
        // S3BACKEND_PREFIX
      ],
    },
    source: {
      type: 'NO_SOURCE',
      buildspec: `\${file("${ensurePath(path.resolve(defRootDir, 'buildspecs', 'deploy-env-infra.yml'))}")}`,
    },
    // NOTE: minutes
    buildTimeout: 60,
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
    tagsAll: {
      ...this.options.tagsAll,
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
          // https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-actions.html
          Effect: 'Allow',
          Resource: [this.cache.arn, `${this.cache.arn}/*`],
          Action: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetObject', 's3:GetObjectAcl', 's3:DeleteObject'],
        },
        {
          // https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-actions.html
          Effect: 'Allow',
          Resource: [this.tfstate.arn, `${this.tfstate.arn}/*`],
          Action: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetObject', 's3:GetObjectAcl', 's3:DeleteObject'],
        },
      ],
    }),
  });

  readonly topic = new SNS.SnsTopic(this, 'topic', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

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
