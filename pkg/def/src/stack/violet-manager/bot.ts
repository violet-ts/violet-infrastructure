import * as path from 'path';
import type { SSM } from '@cdktf/provider-aws';
import { APIGatewayV2, DynamoDB, IAM, LambdaFunction, S3, SNS } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import * as z from 'zod';
import type { VioletManagerStack } from '.';
import type { ApiBuild } from './build-api';
import { ensurePath } from '../../util/ensure-path';
import { botBuildDir } from './values';

export interface BotApiOptions {
  devApiBuild: ApiBuild;
  ssmBotPrefix: string;
  botParameters: SSM.SsmParameter[];
  tags: Record<string, string>;
  prefix: string;
}
export class Bot extends Resource {
  constructor(public parent: VioletManagerStack, name: string, public options: BotApiOptions, config?: ResourceConfig) {
    super(parent, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html
  readonly table = new DynamoDB.DynamodbTable(this, 'table', {
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
    tags: {
      ...this.options.tags,
    },
  });

  // =================================================================
  // IAM Role - Lamabda for Violet bot
  // =================================================================
  readonly botRole = new IAM.IamRole(this, 'botRole', {
    name: `${this.options.prefix}-${this.suffix.result}`,
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
    tags: {
      ...this.options.tags,
    },
  });

  // =================================================================
  // IAM User - Bot
  // -----------------------------------------------------------------
  // ボットをローカルでテストする用のユーザ
  // 必要に応じてアクセスキーを作成し、終わったらキーは削除する
  // =================================================================
  readonly botLocal = new IAM.IamUser(this, 'botLocal', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    forceDestroy: true,
    tags: {
      ...this.options.tags,
      ForLocal: 'true',
    },
  });

  // =================================================================
  // IAM Policy - Lambda for Violet bot
  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy
  // =================================================================
  readonly botPolicy = new IAM.IamPolicy(this, 'botPolicy', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Resource: ['*'],
          Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        },
        {
          Effect: 'Allow',
          Resource: [this.options.devApiBuild.build.arn],
          Action: ['codebuild:ListBuildsForProject', 'codebuild:StartBuild', 'codebuild:BatchGetBuilds'],
        },
        {
          Effect: 'Allow',
          Action: [
            `dynamodb:PutItem`,
            `dynamodb:BatchPutItem`,
            `dynamodb:GetItem`,
            `dynamodb:BatchWriteItem`,
            `dynamodb:UpdateItem`,
            `dynamodb:DeleteItem`,
            `dynamodb:Query`,
            `dynamodb:Scan`,
          ],
          Resource: [this.table.arn],
        },
        {
          Effect: 'Allow',
          Action: ['logs:FilterLogEvents'],
          Resource: [
            `arn:aws:logs:${this.parent.options.region}:${this.parent.options.sharedEnv.AWS_ACCOUNT_ID}:log-group:/aws/codebuild/${this.options.devApiBuild.build.name}:*`,
          ],
        },
        {
          Effect: 'Allow',
          Action: ['ssm:GetParameter', 'ssm:GetParameters'],
          Resource: this.options.botParameters.map((p) => p.arn),
        },
      ],
    }),
    tags: {
      ...this.options.tags,
    },
  });

  // =================================================================
  // IAM Policy Attachment - Lambda for Violet bot
  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy_attachment
  // =================================================================
  readonly botPolicyAttachment = new IAM.IamPolicyAttachment(this, 'botPolicyAttachment', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    roles: [z.string().parse(this.botRole.name)],
    users: [this.botLocal.name],
    policyArn: this.botPolicy.arn,
  });

  // =================================================================
  // API Gateway - Violet GitHub Bot
  // https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid.html
  // =================================================================
  readonly botApi = new APIGatewayV2.Apigatewayv2Api(this, 'botApi', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    protocolType: 'HTTP',
    tags: {
      ...this.options.tags,
    },
  });

  // =================================================================
  // S3 Bucket - Lambda for Violet bot
  // =================================================================
  readonly botLambdaS3 = new S3.S3Bucket(this, 'botLambdaS3', {
    bucket: `${this.options.prefix}-lambda-${this.suffix.result}`,
    acl: 'private',
    forceDestroy: true,
    tags: {
      ...this.options.tags,
    },
  });

  readonly githubBotZipPath = ensurePath(path.resolve(botBuildDir, 'github-bot.zip'));

  readonly githubBotZip = new S3.S3BucketObject(this, 'githubBotZip', {
    bucket: z.string().parse(this.botLambdaS3.bucket),
    key: `github-bot-\${sha1(filebase64("${this.githubBotZipPath}"))}.zip`,
    source: this.githubBotZipPath,
    forceDestroy: true,
    tags: {
      ...this.options.tags,
    },
  });

  readonly onAnyZipPath = ensurePath(path.resolve(botBuildDir, 'on-any.zip'));

  readonly onAnyZip = new S3.S3BucketObject(this, 'onAnyZip', {
    bucket: z.string().parse(this.botLambdaS3.bucket),
    key: `on-any-\${sha1(filebase64("${this.onAnyZipPath}"))}.zip`,
    source: this.onAnyZipPath,
    forceDestroy: true,
    tags: {
      ...this.options.tags,
    },
  });

  readonly lambdaEnvs = {
    variables: {
      SSM_PREFIX: this.options.ssmBotPrefix,
      API_BUILD_PROJECT_NAME: this.options.devApiBuild.build.name,
      TABLE_NAME: this.table.name,
    },
  };

  // Main Lambda function triggered by GitHub webhooks
  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function
  readonly botFunction = new LambdaFunction.LambdaFunction(this, 'botFunction', {
    functionName: `${this.options.prefix}-github-bot-${this.suffix.result}`,
    s3Bucket: this.botLambdaS3.bucket,
    s3Key: this.githubBotZip.key,
    role: this.botRole.arn,
    memorySize: 256,
    environment: this.lambdaEnvs,
    timeout: 20,
    handler: 'github-bot.handler',
    runtime: 'nodejs14.x',
    tags: {
      ...this.options.tags,
    },
  });

  readonly onAnyFunction = new LambdaFunction.LambdaFunction(this, 'onAnyFunction', {
    functionName: `${this.options.prefix}-on-any-${this.suffix.result}`,
    s3Bucket: this.botLambdaS3.bucket,
    s3Key: this.onAnyZip.key,
    role: this.botRole.arn,
    memorySize: 256,
    environment: this.lambdaEnvs,
    timeout: 20,
    handler: 'on-any.handler',
    runtime: 'nodejs14.x',
    tags: {
      ...this.options.tags,
    },
  });

  readonly allowApigwToBotFunction = new LambdaFunction.LambdaPermission(this, 'allowApigwToBotFunction', {
    statementId: 'AllowExecutionFromAPIGatewayv2',
    action: 'lambda:InvokeFunction',
    functionName: this.botFunction.functionName,
    principal: 'apigateway.amazonaws.com',
    sourceArn: `${this.botApi.executionArn}/*/*/*`,
  });

  readonly allowExecutionFromDevApiBuild = new LambdaFunction.LambdaPermission(this, 'allowExecutionFromDevApiBuild', {
    statementId: 'AllowExecutionFromDevApiBuild',
    action: 'lambda:InvokeFunction',
    functionName: this.onAnyFunction.functionName,
    principal: 'sns.amazonaws.com',
    sourceArn: this.options.devApiBuild.topic.arn,
  });

  readonly subscription = new SNS.SnsTopicSubscription(this, 'subscription', {
    topicArn: this.options.devApiBuild.topic.arn,
    protocol: 'lambda',
    endpoint: this.onAnyFunction.arn,
  });

  // API to Lambda for Violet bot
  readonly botInteg = new APIGatewayV2.Apigatewayv2Integration(this, 'botInteg', {
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

  // API to Lambda for Violet bot
  readonly botApiHookRoute = new APIGatewayV2.Apigatewayv2Route(this, 'botApiHookRoute', {
    apiId: this.botApi.id,
    routeKey: 'POST /hook',
    target: `integrations/${this.botInteg.id}`,
  });

  readonly botApiDefaultStage = new APIGatewayV2.Apigatewayv2Stage(this, 'botApiDefaultStage', {
    apiId: this.botApi.id,
    name: '$default',
    autoDeploy: true,
    tags: {
      ...this.options.tags,
    },
    // TODO(logging)
    // accessLogSettings:[{
    //   destinationArn : aws_cloudwatch_log_group.api_gateway_sample.arn,
    //   format          : JSON.stringify({ "requestId" : "$context.requestId", "ip" : "$context.identity.sourceIp", "requestTime" : "$context.requestTime", "httpMethod" : "$context.httpMethod", "routeKey" : "$context.routeKey", "status" : "$context.status", "protocol" : "$context.protocol", "responseLength" : "$context.responseLength" }),
    // }]
  });
}
