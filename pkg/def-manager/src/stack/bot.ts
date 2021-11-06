import type { ECR, Route53 } from '@cdktf/provider-aws';
import { APIGatewayV2, CloudWatch, DynamoDB, IAM, S3, SSM } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import type { ComputedBotEnv } from '@self/shared/lib/bot/env';
import { ensurePath } from '@self/shared/lib/def/util/ensure-path';
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
  prefix: string;
  logsPrefix: string;
  ssmPrefix: string;

  infraSourceBucket: S3.S3Bucket;
  infraSourceZip: S3.S3BucketObject;

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

  readonly logsPrefix = this.options.logsPrefix;

  readonly ssmPrefix = this.options.ssmPrefix;

  // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html
  readonly table = new DynamoDB.DynamodbTable(this, 'table', {
    name: `violet-bot-${this.suffix.result}`,
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

  readonly computedBotEnv: ComputedBotEnv = {
    PREVIEW_DOMAIN: z.string().parse(this.options.previewZone.name),
    INFRA_SOURCE_BUCKET: z.string().parse(this.options.infraSourceBucket.bucket),
    INFRA_SOURCE_ZIP_KEY: this.options.infraSourceZip.key,
    BOT_SSM_PREFIX: this.ssmPrefix,
    BOT_TABLE_NAME: this.table.name,
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

  readonly accessLogGroup = new CloudWatch.CloudwatchLogGroup(this, 'accessLogGroup', {
    name: `${this.options.logsPrefix}/access`,
    retentionInDays: 3,

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

  readonly role = new IAM.IamRole(this, 'role', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    assumeRolePolicy: this.roleAssumeDocument.json,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid.html
  readonly api = new APIGatewayV2.Apigatewayv2Api(this, 'api', {
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
    key: `github-bot-\${sha1(filebase64("${this.githubBotZipPath}"))}.zip`,
    source: this.githubBotZipPath,
    forceDestroy: true,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly onAnyZipPath = ensurePath(path.resolve(botBuildDir, 'on-any.zip'));

  readonly onAnyZip = new S3.S3BucketObject(this, 'onAnyZip', {
    bucket: z.string().parse(this.ghWebhookBucket.bucket),
    key: `on-any-\${sha1(filebase64("${this.onAnyZipPath}"))}.zip`,
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
}
