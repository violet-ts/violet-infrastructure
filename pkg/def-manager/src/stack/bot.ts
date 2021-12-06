import type { ECR, Route53 } from '@cdktf/provider-aws';
import { APIGatewayV2, CloudWatch, DynamoDB, IAM, S3, SNS, SQS, SSM } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import type { ComputedBotEnv } from '@self/shared/lib/bot/env';
import { devInfoLogRetentionDays } from '@self/shared/lib/const/logging';
import { ensurePath } from '@self/shared/lib/def/util/ensure-path';
import { Fn } from 'cdktf';
import type { Construct } from 'constructs';
import * as path from 'path';
import { z } from 'zod';
import type { CodeBuildStack } from './codebuild-stack';
import type { DictContext } from './context/dict';
import { botBuildDir, botEnv } from './values';

export type BuildDictContext = DictContext<CodeBuildStack>;
export type RepoDictContext = DictContext<ECR.EcrRepository>;

export interface BotOptions {
  tagsAll?: Record<string, string>;
  /** len <= 20 */
  prefix: string;
  logsPrefix: string;
  ssmPrefix: string;

  infraSourceBucket: S3.S3Bucket;
  infraSourceZip: S3.S3BucketObject;
  gcipConfigJson: string;
  gcipProject: string;

  previewZone: Route53.DataAwsRoute53Zone;
}
export class Bot extends Resource {
  constructor(scope: Construct, name: string, public options: BotOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  // TODO(cost): lifecycle
  readonly buildArtifact = new S3.S3Bucket(this, 'buildArtifact', {
    bucket: `violet-build-artifact-${this.suffix.result}`,
    forceDestroy: true,
    acl: 'public-read',
    corsRule: [
      {
        allowedHeaders: ['*'],
        allowedMethods: ['GET'],
        allowedOrigins: ['github.com'],
      },
    ],
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly logsPrefix = this.options.logsPrefix;

  readonly ssmPrefix = this.options.ssmPrefix;

  // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html
  readonly issueMap = new DynamoDB.DynamodbTable(this, 'issueMap', {
    // len = 20 + 6 + 6 = 32
    name: `${this.options.prefix}-issu-${this.suffix.result}`,
    billingMode: 'PAY_PER_REQUEST',
    attribute: [
      {
        name: 'number',
        type: 'N',
      },
    ],
    hashKey: 'number',
  });

  // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html
  readonly table = new DynamoDB.DynamodbTable(this, 'table', {
    // len = 20 + 5 + 6 = 31
    name: `${this.options.prefix}-${this.suffix.result}`,
    billingMode: 'PAY_PER_REQUEST',
    ttl: {
      enabled: true,
      attributeName: 'ttl',
    },
    attribute: [
      {
        name: 'uuid',
        type: 'S',
      },
    ],
    hashKey: 'uuid',
  });

  readonly topic = new SNS.SnsTopic(this, 'topic', {
    // len = 20 + 1 + 6 = 27
    name: `${this.options.prefix}-${this.suffix.result}`,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly computedBotEnv: ComputedBotEnv = {
    PREVIEW_DOMAIN: z.string().parse(this.options.previewZone.name),
    INFRA_SOURCE_BUCKET: z.string().parse(this.options.infraSourceBucket.bucket),
    INFRA_SOURCE_ZIP_KEY: this.options.infraSourceZip.key,
    BUILD_ARTIFACT_BUCKET: z.string().parse(this.buildArtifact.bucket),
    BOT_SSM_PREFIX: this.ssmPrefix,
    BOT_TABLE_NAME: this.table.name,
    BOT_ISSUE_MAP_TABLE_NAME: this.issueMap.name,
    BOT_TOPIC_NAME: z.string().parse(this.topic.name),
    GCIP_CONFIG_JSON: this.options.gcipConfigJson,
    GCIP_PROJECT: this.options.gcipProject,
  };

  readonly parameters = botEnv.map(
    ([key, value]) =>
      new SSM.SsmParameter(this, `parameters-${key}`, {
        name: `${this.options.ssmPrefix}/${key}`,
        value,
        type: 'SecureString',

        tagsAll: {
          ...this.options.tagsAll,
        },
      }),
  );

  readonly commonPolicyDocument = new IAM.DataAwsIamPolicyDocument(this, 'commonPolicyDocument', {
    version: '2012-10-17',
    statement: [
      // TODO(security): restrict
      {
        effect: 'Allow',
        resources: ['*'],
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      },
      {
        effect: 'Allow',
        actions: [
          `dynamodb:PutItem`,
          `dynamodb:BatchPutItem`,
          `dynamodb:GetItem`,
          `dynamodb:BatchWriteItem`,
          `dynamodb:UpdateItem`,
          `dynamodb:DeleteItem`,
          `dynamodb:Query`,
          `dynamodb:Scan`,
        ],
        resources: [this.table.arn, this.issueMap.arn],
      },
      {
        effect: 'Allow',
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: this.parameters.map((p) => p.arn),
      },
    ],
  });

  readonly accessLogGroup = new CloudWatch.CloudwatchLogGroup(this, 'accessLogGroup', {
    name: `${this.options.logsPrefix}/access`,
    retentionInDays: devInfoLogRetentionDays,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/dynamodb_table_item
  // ローカルでのスクリプト実行時のダミー用
  readonly dummyItem = new DynamoDB.DynamodbTableItem(this, 'dummyItem', {
    tableName: this.table.name,
    hashKey: this.table.hashKey,
    item: JSON.stringify({
      [this.table.hashKey]: { S: 'dummy' },
    }),
  });

  readonly roleAssumeDocument = new IAM.DataAwsIamPolicyDocument(this, 'roleAssumeDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        principals: [
          {
            type: 'Service',
            identifiers: ['lambda.amazonaws.com'],
          },
        ],
        actions: ['sts:AssumeRole'],
      },
    ],
  });

  readonly ghWebhookExecRole = new IAM.IamRole(this, 'ghWebhookExecRole', {
    // len = 20 + 5 + 6 = 31
    name: `${this.options.prefix}-ghe-${this.suffix.result}`,
    assumeRolePolicy: this.roleAssumeDocument.json,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly onAnyExecRole = new IAM.IamRole(this, 'onAnyExecRole', {
    // len = 20 + 5 + 6 = 31
    name: `${this.options.prefix}-oae-${this.suffix.result}`,
    assumeRolePolicy: this.roleAssumeDocument.json,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy
  readonly commonPolicy = new IAM.IamPolicy(this, 'commonPolicy', {
    namePrefix: this.options.prefix,
    policy: this.commonPolicyDocument.json,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy_attachment
  readonly commonPolicyAttach = new IAM.IamPolicyAttachment(this, 'commonPolicyAttach', {
    // len = 20 + 1 + 6 = 27
    name: `${this.options.prefix}-${this.suffix.result}`,
    roles: [z.string().parse(this.ghWebhookExecRole.name), z.string().parse(this.onAnyExecRole.name)],
    policyArn: this.commonPolicy.arn,
  });

  // https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid.html
  readonly api = new APIGatewayV2.Apigatewayv2Api(this, 'api', {
    // len = 20 + 1 + 6 = 27
    name: `${this.options.prefix}-${this.suffix.result}`,
    protocolType: 'HTTP',

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly ghWebhookBucket = new S3.S3Bucket(this, 'ghWebhookBucket', {
    bucket: `${this.options.prefix}-lambda-${this.suffix.result}`,
    acl: 'private',
    forceDestroy: true,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly githubBotZipPath = ensurePath(path.resolve(botBuildDir, 'github-bot.zip'));

  readonly githubBotZip = new S3.S3BucketObject(this, 'githubBotZip', {
    bucket: z.string().parse(this.ghWebhookBucket.bucket),
    key: `github-bot-${Fn.sha1(Fn.filebase64(this.githubBotZipPath))}.zip`,
    source: this.githubBotZipPath,
    forceDestroy: true,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly onAnyZipPath = ensurePath(path.resolve(botBuildDir, 'on-any.zip'));

  readonly onAnyZip = new S3.S3BucketObject(this, 'onAnyZip', {
    bucket: z.string().parse(this.ghWebhookBucket.bucket),
    key: `on-any-${Fn.sha1(Fn.filebase64(this.onAnyZipPath))}.zip`,
    source: this.onAnyZipPath,
    forceDestroy: true,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly webhookRoute = '/hook';

  readonly webhookEndpoint = `${this.api.apiEndpoint}${this.webhookRoute}`;

  readonly apiDefaultStage = new APIGatewayV2.Apigatewayv2Stage(this, 'apiDefaultStage', {
    apiId: this.api.id,
    name: '$default',
    autoDeploy: true,
    accessLogSettings: {
      destinationArn: this.accessLogGroup.arn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        ip: '$context.identity.sourceIp',
        requestTime: '$context.requestTime',
        httpMethod: '$context.httpMethod',
        routeKey: '$context.routeKey',
        status: '$context.status',
        protocol: '$context.protocol',
        responseLength: '$context.responseLength',
      }),
    },

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly onAnyQueue = new SQS.SqsQueue(this, 'onAnyQueue', {
    // len = 20 + 4 + 6 = 30
    name: `${this.options.prefix}-oa-${this.suffix.result}`,
  });

  // on-any-queue (allow)----> (document)
  readonly allowReceiveQueueDoc = new IAM.DataAwsIamPolicyDocument(this, 'allowReceiveQueueDoc', {
    version: '2012-10-17',
    statement: [
      {
        // https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#events-sqs-permissions
        effect: 'Allow',
        resources: [this.onAnyQueue.arn],
        actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
      },
    ],
  });

  //  on-any-queue (allow)----> on-any-lambda
  readonly allowReceiveQueueToOnAnyFunctionPolicy = new IAM.IamRolePolicy(
    this,
    'allowReceiveQueueToOnAnyFunctionPolicy',
    {
      // len = 20 + 5 + 6 = 31
      name: `${this.options.prefix}-oaq-${this.suffix.result}`,
      role: z.string().parse(this.onAnyExecRole.name),
      policy: this.allowReceiveQueueDoc.json,
    },
  );

  // bot-topic ---->(allow) on-any-queue (document)
  readonly allowBotTopicToOnAnyQueueDoc = new IAM.DataAwsIamPolicyDocument(this, 'allowBotTopicToOnAnyQueueDoc', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        principals: [
          {
            type: 'Service',
            identifiers: ['sns.amazonaws.com'],
          },
        ],
        actions: ['sqs:SendMessage'],
        resources: [this.onAnyQueue.arn],
        condition: [
          {
            test: 'ArnEquals',
            variable: 'aws:SourceArn',
            values: [this.topic.arn],
          },
        ],
      },
    ],
  });

  // bot-topic ---->(allow) on-any-queue
  readonly allowBotTopicToOnAnyQueue = new SQS.SqsQueuePolicy(this, 'allowBotTopicToOnAnyQueue', {
    queueUrl: this.onAnyQueue.url,
    policy: this.allowBotTopicToOnAnyQueueDoc.json,
  });

  // bot-topic --(subscribe)--> on-any-queue
  readonly botTopicSubscriptionToOnAnyQueue = new SNS.SnsTopicSubscription(this, 'botTopicSubscriptionToOnAnyQueue', {
    topicArn: this.topic.arn,
    protocol: 'sqs',
    endpoint: this.onAnyQueue.arn,
    dependsOn: [this.allowBotTopicToOnAnyQueue],
  });
}
