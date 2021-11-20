import { CloudWatch, CodeBuild, CodeStar, IAM, S3, SNS } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import { computedBotCodeBuildEnv } from '@self/shared/lib/bot/env';
import type { CodeBuildStackEnv } from '@self/shared/lib/codebuild-stack/env';
import { codeBuildStackCodeBuildEnv } from '@self/shared/lib/codebuild-stack/env';
import { devInfoLogRetentionDays } from '@self/shared/lib/const/logging';
import type { ManagerEnv, SharedEnv } from '@self/shared/lib/def/env-vars';
import { sharedCodeBuildEnv } from '@self/shared/lib/def/env-vars';
import { ensurePath } from '@self/shared/lib/def/util/ensure-path';
import type { CodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import { Fn } from 'cdktf';
import type { Construct } from 'constructs';
import * as path from 'path';
import { z } from 'zod';
import type { Bot } from './bot';
import { dataDir } from './values';

// Opinionated CodeBuild stack.

export interface CodeBuildStackOptions {
  tagsAll: Record<string, string>;
  sharedEnv: SharedEnv;
  managerEnv: ManagerEnv;
  buildSpecName: string;
  prefix: string;
  logsPrefix: string;
  environmentVariable: CodeBuildEnv;
  bot: Bot;
}

export class CodeBuildStack extends Resource {
  constructor(scope: Construct, name: string, public options: CodeBuildStackOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  // TODO: https://github.com/hashicorp/terraform-provider-aws/issues/10195
  readonly cachename = `${this.options.prefix}-${this.options.sharedEnv.MANAGER_NAMESPACE}-cache`;

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

  readonly buildLogGroup = new CloudWatch.CloudwatchLogGroup(this, 'buildLogGroup', {
    namePrefix: `${this.options.logsPrefix}/build`,
    retentionInDays: devInfoLogRetentionDays,

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

  readonly codeBuildStackEnv: CodeBuildStackEnv = {
    SCRIPT_ROLE_NAME: z.string().parse(this.role.name),
  };

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_project
  // https://docs.aws.amazon.com/codebuild/latest/APIReference/API_CreateProject.html
  // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html
  readonly build = new CodeBuild.CodebuildProject(this, 'build', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    concurrentBuildLimit: 10,
    environment: {
      // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-compute-types.html
      computeType: 'BUILD_GENERAL1_SMALL',
      type: 'LINUX_CONTAINER',
      // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
      image: 'aws/codebuild/standard:5.0',
      imagePullCredentialsType: 'CODEBUILD',
      privilegedMode: true,
      environmentVariable: [
        ...sharedCodeBuildEnv(this.options.sharedEnv),
        ...codeBuildStackCodeBuildEnv(this.codeBuildStackEnv),
        ...computedBotCodeBuildEnv(this.options.bot.computedBotEnv),
        ...this.options.environmentVariable,
      ],
    },
    source: {
      type: 'NO_SOURCE',
      buildspec: Fn.file(ensurePath(path.resolve(dataDir, 'buildspecs', this.options.buildSpecName))),
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

    dependsOn: [this.cache],
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
        actions: ['s3:Get*', 's3:List*', 's3:CopyObject', 's3:Put*', 's3:HeadObject', 's3:DeleteObject*'],
      },
    ],
  });

  readonly rolePolicy = new IAM.IamRolePolicy(this, 'rolePolicy', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    role: z.string().parse(this.role.name),
    policy: this.rolePolicyDocument.json,
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
        resources: [this.options.bot.topic.arn],
      },
    ],
  });

  readonly topicPolicy = new SNS.SnsTopicPolicy(this, 'topicPolicy', {
    arn: this.options.bot.topic.arn,
    policy: this.topicPolicyDoc.json,
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codestarnotifications_notification_rule
  readonly notification = new CodeStar.CodestarnotificationsNotificationRule(this, 'notification', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    resource: this.build.arn,
    detailType: 'BASIC',
    // https://docs.aws.amazon.com/dtconsole/latest/userguide/concepts.html#concepts-api
    eventTypeIds: [
      'codebuild-project-build-state-failed',
      'codebuild-project-build-state-succeeded',
      'codebuild-project-build-state-in-progress',
      'codebuild-project-build-state-stopped',
    ],
    target: [
      {
        type: 'SNS',
        address: this.options.bot.topic.arn,
      },
    ],
    // TODO(logging): fail

    tagsAll: {
      ...this.options.tagsAll,
    },
  });
}
