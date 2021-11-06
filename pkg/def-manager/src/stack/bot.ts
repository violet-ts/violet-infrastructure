import * as path from 'path';
import type { ECR, Route53 } from '@cdktf/provider-aws';
import { SSM, APIGatewayV2, DynamoDB, IAM, LambdaFunction, S3, SNS, CloudWatch } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import { z } from 'zod';
import { ensurePath } from '@self/shared/lib/def/util/ensure-path';
import type { ComputedBotEnv } from '@self/shared/lib/bot/env';
import type { Construct } from 'constructs';
import { botBuildDir, botEnv } from './values';
import type { DictContext } from './context/dict';
import type { CodeBuildStack } from './codebuild-stack';

export type BuildDictContext = DictContext<CodeBuildStack>;
export type RepoDictContext = DictContext<ECR.EcrRepository>;

export interface BotApiOptions {
  ssmPrefix: string;
  tagsAll?: Record<string, string>;
  prefix: string;
  logsPrefix: string;
  table: DynamoDB.DynamodbTable;

  buildDictContext: BuildDictContext;
  repoDictContext: RepoDictContext;

  previewZone: Route53.DataAwsRoute53Zone;
}
export class Bot extends Resource {
  constructor(scope: Construct, name: string, public options: BotApiOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

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
    tableName: this.options.table.name,
    hashKey: this.options.table.hashKey,
    item: JSON.stringify({
      [this.options.table.hashKey]: { S: 'dummy' },
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

  // ボットをローカルでテストする用のユーザ
  // 必要に応じてアクセスキーを作成し、終わったらキーは削除する
  readonly user = new IAM.IamUser(this, 'user', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    forceDestroy: true,

    tagsAll: {
      ...this.options.tagsAll,
      ForLocal: 'true',
    },
  });

  readonly policyDocument = new IAM.DataAwsIamPolicyDocument(this, 'policyDocument', {
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
        resources: this.options.buildDictContext.getAll().map(([_name, build]) => build.build.arn),
        actions: ['codebuild:ListBuildsForProject', 'codebuild:StartBuild', 'codebuild:BatchGetBuilds'],
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
        resources: [this.options.table.arn],
      },
      {
        // https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonelasticcontainerregistry.html
        effect: 'Allow',
        // Read actions
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:BatchGetImage',
          'ecr:DescribeImageReplicationStatus',
          'ecr:DescribeImages',
          'ecr:DescribeRepositories',
          'ecr:GetDownloadUrlForLayer',
          'ecr:GetLifecyclePolicy',
          'ecr:GetLifecyclePolicyPreview',
          'ecr:GetRepositoryPolicy',
          'ecr:ListImages',
          'ecr:ListTagsForResource',
        ],
        resources: this.options.repoDictContext.getAll().map(([_name, repo]) => repo.arn),
      },
      {
        effect: 'Allow',
        actions: ['logs:FilterLogEvents'],
        resources: this.options.buildDictContext.getAll().map(([_name, build]) => `${build.buildLogGroup.arn}:*`),
      },
      // TODO(security): restrict
      {
        effect: 'Allow',
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: this.parameters.map((p) => p.arn),
      },
    ],
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy
  readonly policy = new IAM.IamPolicy(this, 'policy', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    policy: this.policyDocument.json,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy_attachment
  readonly policyAttach = new IAM.IamPolicyAttachment(this, 'policyAttach', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    roles: [z.string().parse(this.role.name)],
    users: [this.user.name],
    policyArn: this.policy.arn,
  });

  // https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid.html
  readonly api = new APIGatewayV2.Apigatewayv2Api(this, 'api', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    protocolType: 'HTTP',

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly lambdaS3 = new S3.S3Bucket(this, 'lambdaS3', {
    bucket: `${this.options.prefix}-lambda-${this.suffix.result}`,
    acl: 'private',
    forceDestroy: true,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly githubBotZipPath = ensurePath(path.resolve(botBuildDir, 'github-bot.zip'));

  readonly githubBotZip = new S3.S3BucketObject(this, 'githubBotZip', {
    bucket: z.string().parse(this.lambdaS3.bucket),
    key: `github-bot-\${sha1(filebase64("${this.githubBotZipPath}"))}.zip`,
    source: this.githubBotZipPath,
    forceDestroy: true,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly onAnyZipPath = ensurePath(path.resolve(botBuildDir, 'on-any.zip'));

  readonly onAnyZip = new S3.S3BucketObject(this, 'onAnyZip', {
    bucket: z.string().parse(this.lambdaS3.bucket),
    key: `on-any-\${sha1(filebase64("${this.onAnyZipPath}"))}.zip`,
    source: this.onAnyZipPath,
    forceDestroy: true,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly computedBotEnv: ComputedBotEnv = {
    PREVIEW_DOMAIN: z.string().parse(this.options.previewZone.name),
    BOT_SSM_PREFIX: this.options.ssmPrefix,
    BOT_TABLE_NAME: this.options.table.name,

    API_REPO_NAME: this.options.repoDictContext.get('Api').name,
    WEB_REPO_NAME: this.options.repoDictContext.get('Web').name,
    LAMBDA_REPO_NAME: this.options.repoDictContext.get('Lam').name,

    API_BUILD_PROJECT_NAME: this.options.buildDictContext.get('Api').build.name,
    WEB_BUILD_PROJECT_NAME: this.options.buildDictContext.get('Web').build.name,
    LAMBDA_BUILD_PROJECT_NAME: this.options.buildDictContext.get('Lam').build.name,
    OPERATE_ENV_PROJECT_NAME: this.options.buildDictContext.get('Ope').build.name,
    PR_UPDATE_LABELS_PROJECT_NAME: this.options.buildDictContext.get('UpLa').build.name,
  };

  // Main Lambda function triggered by GitHub webhooks
  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function
  // TODO(logging): retention
  readonly lambda = new LambdaFunction.LambdaFunction(this, 'lambda', {
    functionName: `${this.options.prefix}-github-bot-${this.suffix.result}`,
    s3Bucket: this.lambdaS3.bucket,
    s3Key: this.githubBotZip.key,
    role: this.role.arn,
    memorySize: 256,
    environment: {
      variables: this.computedBotEnv,
    },
    timeout: 20,
    handler: 'github-bot.handler',
    runtime: 'nodejs14.x',

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // TODO(logging): retention
  readonly onAnyFunction = new LambdaFunction.LambdaFunction(this, 'onAnyFunction', {
    functionName: `${this.options.prefix}-on-any-${this.suffix.result}`,
    s3Bucket: this.lambdaS3.bucket,
    s3Key: this.onAnyZip.key,
    role: this.role.arn,
    memorySize: 256,
    environment: {
      variables: this.computedBotEnv,
    },
    timeout: 20,
    handler: 'on-any.handler',
    runtime: 'nodejs14.x',

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly allowApigwToBotFunction = new LambdaFunction.LambdaPermission(this, 'allowApigwToBotFunction', {
    statementId: 'AllowExecutionFromAPIGatewayv2',
    action: 'lambda:InvokeFunction',
    functionName: this.lambda.functionName,
    principal: 'apigateway.amazonaws.com',
    sourceArn: `${this.api.executionArn}/*/*/*`,
  });

  readonly allowExecutionFromBuild = this.options.buildDictContext.getAll().map(
    ([name, porject]) =>
      new LambdaFunction.LambdaPermission(this, `allowExecutionFromBuild-${name}`, {
        statementId: `AllowExecutionFrom${name}`,
        action: 'lambda:InvokeFunction',
        functionName: this.onAnyFunction.functionName,
        principal: 'sns.amazonaws.com',
        sourceArn: porject.topic.arn,
      }),
  );

  readonly subscription = this.options.buildDictContext.getAll().map(
    ([name, build]) =>
      new SNS.SnsTopicSubscription(this, `subscription-${name}`, {
        topicArn: build.topic.arn,
        protocol: 'lambda',
        endpoint: this.onAnyFunction.arn,
      }),
  );

  readonly integ = new APIGatewayV2.Apigatewayv2Integration(this, 'integ', {
    apiId: this.api.id,
    integrationType: 'AWS_PROXY',

    // connectionType: 'INTERNET',
    // contentHandlingStrategy: 'CONVERT_TO_TEXT',
    // description: 'Lambda todo',
    integrationMethod: 'POST',
    integrationUri: this.lambda.invokeArn,
    payloadFormatVersion: '2.0',
    // passthroughBehavior: 'WHEN_NO_MATCH',
  });

  readonly webhookRoute = '/hook';

  readonly webhookEndpoint = `${this.api.apiEndpoint}${this.webhookRoute}`;

  readonly apiHookRoute = new APIGatewayV2.Apigatewayv2Route(this, 'apiHookRoute', {
    apiId: this.api.id,
    routeKey: `POST ${this.webhookRoute}`,
    target: `integrations/${this.integ.id}`,
  });

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
