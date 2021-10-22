import type { EcrRepository } from '@cdktf/provider-aws';
import {
  SnsTopic,
  IamRole,
  CodebuildProject,
  CodestarnotificationsNotificationRule,
  DataAwsIamPolicyDocument,
  IamRolePolicy,
  SnsTopicPolicy,
} from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import * as fs from 'fs';
import * as path from 'path';
import type { VioletManagerStack } from '.';
import { defRootDir } from './values';

export interface ApiBuildOptions {
  ecr: EcrRepository;
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

  // =================================================================
  // Random Suffix
  // =================================================================
  readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  // =================================================================
  // IAM Role - CodeBuild
  // =================================================================
  readonly role = new IamRole(this, 'buildRolrole', {
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
    tags: this.options.tags,
  });

  readonly dockerHubRolePolicy =
    this.parent.dockerHubCredentials &&
    new IamRolePolicy(this, 'dockerHubRolePolicy', {
      name: `${this.options.prefix}-dockerhub-${this.suffix.result}`,
      role: this.role.name,
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
  readonly build = new CodebuildProject(this, 'build', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    badgeEnabled: true,
    concurrentBuildLimit: 3,
    environment: [
      {
        // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-compute-types.html
        computeType: 'BUILD_GENERAL1_SMALL',
        type: 'LINUX_CONTAINER',
        // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
        image: 'aws/codebuild/standard:5.0',
        imagePullCredentialsType: 'CODEBUILD',
        privilegedMode: true,
        environmentVariable: [
          ...(this.parent.dockerHubCredentials
            ? [
                {
                  name: 'DOCKERHUB_USER',
                  value: this.parent.dockerHubCredentials.credentialsUserArn,
                  type: 'SECRETS_MANAGER',
                },
                {
                  name: 'DOCKERHUB_PASS',
                  value: this.parent.dockerHubCredentials.credentialsPassArn,
                  type: 'SECRETS_MANAGER',
                },
              ]
            : []),
          {
            name: 'IMAGE_REPO_NAME',
            value: this.options.ecr.name,
          },
          {
            name: 'AWS_ACCOUNT_ID',
            value: this.parent.options.sharedEnv.AWS_ACCOUNT_ID,
          },
          {
            name: 'GIT_FETCH',
            value: 'master',
            // value: 'refs/pull/4/head',
          },
          // TODO(extended): not supported private repos
          // IMAGE_TAG
        ],
      },
    ],
    source: [
      {
        type: 'GITHUB',
        location: 'https://github.com/LumaKernel/violet.git',
        gitCloneDepth: 1,

        gitSubmodulesConfig: [
          {
            fetchSubmodules: true,
          },
        ],

        buildspec: fs.readFileSync(path.resolve(defRootDir, 'buildspecs', 'build-api.yml')).toString(),
      },
    ],
    sourceVersion: 'master',
    // NOTE: minutes
    buildTimeout: 20,
    serviceRole: this.role.arn,
    artifacts: [
      {
        type: 'NO_ARTIFACTS',
      },
    ],
    cache: [
      {
        type: 'LOCAL',
        modes: ['LOCAL_DOCKER_LAYER_CACHE', 'LOCAL_SOURCE_CACHE'],
      },
    ],

    // TODO(logging)
    tags: this.options.tags,
  });

  // NOTE(security): dev 環境の policy で誰でも任意コード実行と考えて設計する
  readonly rolePolicy = new IamRolePolicy(this, 'rolePolicy', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    role: this.role.name,
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        // TODO(security): restrict
        {
          Effect: 'Allow',
          Resource: ['*'],
          Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        },
        // TODO(security): restrict
        {
          Action: [
            'ecr:BatchCheckLayerAvailability',
            'ecr:CompleteLayerUpload',
            'ecr:GetAuthorizationToken',
            'ecr:InitiateLayerUpload',
            'ecr:PutImage',
            'ecr:UploadLayerPart',
          ],
          Resource: '*',
          Effect: 'Allow',
        },
        // TODO(security): restrict
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

  // =================================================================
  // SNS Topic - API Build Notification
  // =================================================================
  readonly topic = new SnsTopic(this, 'topic', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    displayName: 'Violet API Build Notification',
    tags: this.options.tags,
  });

  // =================================================================
  // IAM Policy Document
  // -----------------------------------------------------------------
  // CodeStar Notification に SNS Topic への publish を許可するポリシー
  // =================================================================
  readonly apiBuildTopicPolicyDoc = new DataAwsIamPolicyDocument(this, 'apiBuildTopicPolicyDoc', {
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

  readonly apiBuildTopicPolicy = new SnsTopicPolicy(this, 'apiBuildTopicPolicy', {
    arn: this.topic.arn,
    policy: this.apiBuildTopicPolicyDoc.json,
  });

  // =================================================================
  // CodeStar Notification Rule
  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codestarnotifications_notification_rule
  // =================================================================
  readonly apiBuildNotification = new CodestarnotificationsNotificationRule(this, 'apiBuildNotification', {
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
    tags: this.options.tags,
  });
}
