// eslint-disable-next-line max-classes-per-file
import type { Construct } from 'constructs';
import { TerraformStack } from 'cdktf';
import {
  AwsProvider,
  ResourcegroupsGroup,
  EcrRepository,
  S3Bucket,
  S3BucketObject,
  IamUser,
  IamRole,
  IamPolicy,
  IamRolePolicy,
  Apigatewayv2Api,
  Apigatewayv2Integration,
  Apigatewayv2Route,
  Apigatewayv2Stage,
  LambdaFunction,
  SnsTopic,
  SnsTopicPolicy,
  DataAwsIamPolicyDocument,
  CodebuildProject,
  CodestarnotificationsNotificationRule,
  IamPolicyAttachment,
} from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource, NullProvider } from '@cdktf/provider-null';
import * as fs from 'fs';
import * as path from 'path';
import { RandomProvider, String as RandomString } from '@cdktf/provider-random';
import { PROJECT_NAME } from '../const';
import type { SharedEnv, DevEnv, ProdEnv } from '../util/env-vars';

/**
 * - manage-only
 * - production
 * - development
 *   +- staging
 *   +- preview
 */
export type Section = 'development' | 'preview' | 'staging' | 'production' | 'manage-only';

export interface VioletManagerOptions {
  region: string;
  sharedEnv: SharedEnv;
  devEnv: DevEnv;
  prodEnv: ProdEnv;
}

const genTags = (name: string | null, section?: Section | null): Record<string, string> => {
  const tags: Record<string, string> = {
    Project: PROJECT_NAME,
    /** マネージャ層であることを示すフラグ */
    Manager: 'true',
    /** IaC で管理している、というフラグ */
    Managed: 'true',
  };
  if (name != null) tags.Name = name;
  if (section != null) tags.Section = section;
  return tags;
};

interface DevApiBuildOptions extends VioletManagerOptions {
  name: string;
  suffix: RandomString;
}
class DevApiBuild extends Resource {
  constructor(scope: Construct, name: string, private options: DevApiBuildOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  private tags = genTags(null, 'development');

  // =================================================================
  // S3 Bucket - DB CodeBuild cache
  // =================================================================
  buildCacheS3 = new S3Bucket(this, 'buildCacheS3', {
    bucket: `violet-build-cache-${this.options.suffix.result}`,
    forceDestroy: true,
    tags: this.tags,
  });

  // =================================================================
  // IAM Role - CodeBuild
  // =================================================================
  buildRole = new IamRole(this, 'buildRole', {
    name: `violet-build-${this.options.suffix.result}`,
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
    tags: this.tags,
  });

  buildRolePolicy = new IamRolePolicy(this, 'buildRolePolicy', {
    name: `violet-build-${this.options.suffix.result}`,
    role: this.buildRole.name,
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
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
        {
          Effect: 'Allow',
          Action: [
            'ec2:CreateNetworkInterface',
            'ec2:DescribeDhcpOptions',
            'ec2:DescribeNetworkInterfaces',
            'ec2:DeleteNetworkInterface',
            'ec2:DescribeSubnets',
            'ec2:DescribeSecurityGroups',
            'ec2:DescribeVpcs',
          ],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: ['s3:*'],
          Resource: [`${this.buildCacheS3.arn}`, `${this.buildCacheS3.arn}/*`],
        },
      ],
    }),
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_project
  // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html
  apiBuild = new CodebuildProject(this, 'apiBuild', {
    name: this.options.name,
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
          {
            name: 'IMAGE_REPO_NAME',
            value: this.options.devEnv.ECR_API_DEV_NAME,
          },
          {
            name: 'AWS_ACCOUNT_ID',
            value: this.options.sharedEnv.AWS_ACCOUNT_ID,
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

        buildspec: fs.readFileSync(path.resolve(__dirname, '../buildspecs/build-api.yml')).toString(),
      },
    ],
    sourceVersion: 'master',
    // NOTE: minutes
    buildTimeout: 20,
    serviceRole: this.buildRole.arn,
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
    tags: this.tags,
  });

  // =================================================================
  // SNS Topic - API Build Notification
  // =================================================================
  apiBuildTopic = new SnsTopic(this, 'apiBuildTopic', {
    name: `violet-api-build-${this.options.suffix.result}.fifo`,
    displayName: 'Violet API Build Notification',
    fifoTopic: true,
    // lambdaSuccessFeedbackRoleArn
    tags: this.tags,
  });

  // =================================================================
  // IAM Policy Document
  // -----------------------------------------------------------------
  // CodeStar Notification に SNS Topic への publish を許可するポリシー
  // =================================================================
  apiBuildTopicPolicyDoc = new DataAwsIamPolicyDocument(this, 'apiBuildTopicPolicyDoc', {
    statement: [
      {
        actions: ['sns:Publish'],
        principals: [
          {
            type: 'Service',
            identifiers: ['codestar-notifications.amazonaws.com'],
          },
        ],
        resources: [this.apiBuildTopic.arn],
      },
    ],
  });

  apiBuildTopicPolicy = new SnsTopicPolicy(this, 'apiBuildTopicPolicy', {
    arn: this.apiBuildTopic.arn,
    policy: this.apiBuildTopicPolicyDoc.json,
  });

  // =================================================================
  // CodeStar Notification Rule
  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codestarnotifications_notification_rule
  // =================================================================
  apiBuildNotification = new CodestarnotificationsNotificationRule(this, 'apiBuildNotification', {
    name: `violet-api-build-${this.options.suffix.result}`,
    resource: this.apiBuild.arn,
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
        address: this.apiBuildTopic.arn,
      },
    ],
    tags: this.tags,
  });
}

interface BotApiOptions extends VioletManagerOptions {
  suffix: RandomString;
  devApiBuild: DevApiBuild;
}
class Bot extends Resource {
  private tags = genTags(null, 'manage-only');

  constructor(scope: Construct, name: string, private options: BotApiOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  // =================================================================
  // IAM Role - Lamabda for Violet bot
  // =================================================================
  botRole = new IamRole(this, 'botRole', {
    name: `violet-bot-${this.options.suffix.result}`,
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    }),
    tags: this.tags,
  });

  // =================================================================
  // IAM User - Bot
  // -----------------------------------------------------------------
  // ボットをローカルでテストする用のユーザ
  // 必要に応じてアクセスキーを作成し、終わったらキーは削除する
  // =================================================================
  botLocal = new IamUser(this, 'botLocal', {
    name: `violet-bot-${this.options.suffix.result}`,
    forceDestroy: true,
    tags: {
      ...this.tags,
      ForLocal: 'true',
    },
  });

  // =================================================================
  // IAM Policy - Lambda for Violet bot
  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy
  // =================================================================
  botPolicy = new IamPolicy(this, 'botPolicy', {
    name: `violet-bot-${this.options.suffix.result}`,
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Resource: [this.options.devApiBuild.apiBuild.arn],
          Action: ['codebuild:ListBuildsForProject', 'codebuild:StartBuild', 'codebuild:BatchGetBuilds'],
        },
      ],
    }),
    tags: this.tags,
  });

  // =================================================================
  // IAM Policy Attachment - Lambda for Violet bot
  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy_attachment
  // =================================================================
  botPolicyAttachment = new IamPolicyAttachment(this, 'botPolicyAttachment', {
    name: `violet-bot-${this.options.suffix.result}`,
    roles: [this.botRole.name],
    users: [this.botLocal.name],
    policyArn: this.botPolicy.arn,
  });

  // =================================================================
  // S3 Bucket - Lambda for Violet bot
  // =================================================================
  botLambdaS3 = new S3Bucket(this, 'botLambdaS3', {
    bucket: `violet-bot-lambda-${this.options.suffix.result}`,
    tags: this.tags,
  });

  botLambdaNodeInitialZip = new S3BucketObject(this, 'botLambdaNodeInitialZip', {
    bucket: this.botLambdaS3.bucket,
    key: 'node-initial.zip',
    source: path.resolve(__dirname, '../data/node-initial.zip'),
    tags: this.tags,
  });

  // =================================================================
  // Lambda Function - Lambda for Violet bot
  // =================================================================
  botFunction = new LambdaFunction(this, 'botFunction', {
    functionName: `violet-bot-${this.options.suffix.result}`,
    s3Bucket: this.botLambdaS3.bucket,
    s3Key: this.botLambdaNodeInitialZip.key,
    role: this.botRole.arn,
    timeout: 20,
    handler: 'lambda.handler',
    runtime: 'nodejs14.x',
    tags: this.tags,
    lifecycle: { ignoreChanges: ['s3_key'] },
  });

  // =================================================================
  // API Gateway - Violet GitHub Bot
  // https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid.html
  // =================================================================
  botApi = new Apigatewayv2Api(this, 'botApi', {
    name: `violet-bot-${this.options.suffix.result}`,
    protocolType: 'HTTP',
    tags: this.tags,
  });

  // =================================================================
  // API Gateway V2 Integration - API to Lambda for Violet bot
  // =================================================================
  botInteg = new Apigatewayv2Integration(this, 'botInteg', {
    apiId: this.botApi.id,
    integrationType: 'AWS_PROXY',

    // connectionType: 'INTERNET',
    // contentHandlingStrategy: 'CONVERT_TO_TEXT',
    // description: 'Lambda todo',
    integrationMethod: 'POST',
    integrationUri: this.botFunction.invokeArn,
    payloadFormatVersion: '2.0',
    // passthroughBehavior: 'WHEN_NO_MATCH',
  });

  // =================================================================
  // API Gateway V2 Route - API to Lambda for Violet bot
  // =================================================================
  botApiHookRoute = new Apigatewayv2Route(this, 'botApiHookRoute', {
    apiId: this.botApi.id,
    routeKey: 'POST /hook',
    target: `integrations/${this.botInteg.id}`,
  });

  botApiDefaultStage = new Apigatewayv2Stage(this, 'botApiDefaultStage', {
    apiId: this.botApi.id,
    name: '$default',
    autoDeploy: true,
    tags: this.tags,
    // TODO(logging)
    // accessLogSettings:[{
    //   destinationArn : aws_cloudwatch_log_group.api_gateway_sample.arn,
    //   format          : JSON.stringify({ "requestId" : "$context.requestId", "ip" : "$context.identity.sourceIp", "requestTime" : "$context.requestTime", "httpMethod" : "$context.httpMethod", "routeKey" : "$context.routeKey", "status" : "$context.status", "protocol" : "$context.protocol", "responseLength" : "$context.responseLength" }),
    // }]
  });
}

export class VioletManagerStack extends TerraformStack {
  get uniqueName(): string {
    return `manager-${this.options.region}`;
  }

  constructor(scope: Construct, name: string, private options: VioletManagerOptions) {
    super(scope, name);
  }

  // =================================================================
  // Null Provider
  // =================================================================
  nullProvider = new NullProvider(this, 'nullProvider', {});

  // =================================================================
  // Random Provider
  // https://registry.terraform.io/providers/hashicorp/random/latest
  // =================================================================
  random = new RandomProvider(this, 'random', {});

  // =================================================================
  // Random Suffix
  // https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/string
  // =================================================================
  suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  // =================================================================
  // AWS Provider
  // =================================================================
  awsProvider = new AwsProvider(this, 'aws', {
    region: this.options.region,
    profile: this.options.sharedEnv.AWS_PROFILE,
  });

  // =================================================================
  // Resource Groups
  // -----------------------------------------------------------------
  // Violet プロジェクトすべてのリソース
  // =================================================================
  allResources = new ResourcegroupsGroup(this, 'allResources', {
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
  managerResources = new ResourcegroupsGroup(this, 'managerResources', {
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
  ecsRepoProdFrontend = new EcrRepository(this, 'ecsRepoProdFrontend', {
    name: this.options.prodEnv.ECR_API_PROD_NAME,
    imageTagMutability: 'IMMUTABLE',
    // TODO(security): for production
    // imageScanningConfiguration,
    tags: genTags(null),
  });

  // -----------------------------------------------------------------
  // ECS Repository - Development API
  // -----------------------------------------------------------------
  ecsRepoDevFrontend = new EcrRepository(this, 'ecsRepoDevFrontend', {
    name: this.options.devEnv.ECR_API_DEV_NAME,
    imageTagMutability: 'MUTABLE',
    // TODO(security): for production
    // imageScanningConfiguration,
    tags: genTags(null, 'development'),
  });

  devApiBuild = new DevApiBuild(this, 'devApiBuild', {
    ...this.options,
    suffix: this.suffix,
    name: `violet-dev-build-api`,
  });

  bot = new Bot(this, 'bot', { ...this.options, suffix: this.suffix, devApiBuild: this.devApiBuild });
}
