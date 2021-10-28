import { SNS, IAM, CodeBuild, CodeStar, S3, CloudWatch } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import * as path from 'path';
import * as z from 'zod';
import type { DefSideEnvEnv } from 'violet-infrastructure-shared/lib/deploy-env';
import type { VioletManagerStack } from '.';
import { ensurePath } from '../../util/ensure-path';
import { defRootDir } from './values';

export interface EnvDeployOptions {
  tagsAll: Record<string, string>;
  prefix: string;
  logsPrefix: string;
}

/**
 * 一つの環境を terraform で deploy/destroy するための CodeBuild Project とその関連
 */
export class EnvDeploy extends Resource {
  constructor(
    public parent: VioletManagerStack,
    name: string,
    public options: EnvDeployOptions,
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

  readonly buildLogGroup = new CloudWatch.CloudwatchLogGroup(this, 'buildLogGroup', {
    name: `${this.options.logsPrefix}/build`,
    retentionInDays: 3,

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
        ...envEnvToCodeBuildEnv({
          CIDR_NUM: '0',
          API_REPO_NAME: this.parent.apiDevRepo.name,
          MYSQL_PARAM_JSON: '/main/data/my.cnf.json',
        }),
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
    logsConfig: {
      cloudwatchLogs: {
        groupName: this.buildLogGroup.name,
      },
    },

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly rolePolicyDocument = new IAM.DataAwsIamPolicyDocument(this, 'rolePolicyDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        resources: [`${this.buildLogGroup.arn}:*`],
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      },
      {
        // https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-actions.html
        effect: 'Allow',
        resources: [this.cache.arn, `${this.cache.arn}/*`],
        actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetObject', 's3:GetObjectAcl', 's3:DeleteObject'],
      },
      {
        // https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-actions.html
        effect: 'Allow',
        resources: [this.tfstate.arn, `${this.tfstate.arn}/*`],
        actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetObject', 's3:GetObjectAcl', 's3:DeleteObject'],
      },
    ],
  });

  // NOTE(security): dev 環境の policy で誰でも任意コード実行と考えて設計する
  readonly rolePolicy = new IAM.IamRolePolicy(this, 'rolePolicy', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    role: z.string().parse(this.role.name),
    policy: this.rolePolicyDocument.json,
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
    // TODO(logging): fail

    tagsAll: {
      ...this.options.tagsAll,
    },
  });
}

const envEnvToCodeBuildEnv = (envEnv: DefSideEnvEnv): Array<{ name: string; value: string }> => {
  return Object.entries(envEnv).map(([name, value]) => {
    return { name, value };
  });
};
