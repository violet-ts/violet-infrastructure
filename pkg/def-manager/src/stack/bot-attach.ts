import type { ecr } from '@cdktf/provider-aws';
import { apigatewayv2, iam, lambdafunction } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { StringResource as RandomString } from '@cdktf/provider-random';
import type { AccumuratedBotEnv, ComputedAfterwardBotEnv } from '@self/shared/lib/bot/env';
import { accumuratedBotEnvSchema } from '@self/shared/lib/bot/env';
import type { SharedEnv } from '@self/shared/lib/def/env-vars';
import type { Construct } from 'constructs';
import { z } from 'zod';
import type { Bot } from './bot';
import type { CodeBuildStack } from './codebuild-stack';
import type { DictContext } from './context/dict';

export type BuildDictContext = DictContext<CodeBuildStack>;
export type RepoDictContext = DictContext<ecr.EcrRepository>;

export interface BotAttachOptions {
  tagsAll?: Record<string, string>;
  prefix: string;
  bot: Bot;
  sharedEnv: SharedEnv;

  buildDictContext: BuildDictContext;
  repoDictContext: RepoDictContext;
}
export class BotAttach extends Resource {
  constructor(scope: Construct, name: string, public options: BotAttachOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  readonly computedAfterwardBotEnv: ComputedAfterwardBotEnv = {
    API_REPO_NAME: this.options.repoDictContext.get('Api').name,
    WEB_REPO_NAME: this.options.repoDictContext.get('Web').name,
    LAMBDA_CONV2IMG_REPO_NAME: this.options.repoDictContext.get('LamC2i').name,
    LAMBDA_APIEXEC_REPO_NAME: this.options.repoDictContext.get('LamAe').name,

    API_BUILD_PROJECT_NAME: this.options.buildDictContext.get('Api').build.name,
    WEB_BUILD_PROJECT_NAME: this.options.buildDictContext.get('Web').build.name,
    LAMBDA_CONV2IMG_BUILD_PROJECT_NAME: this.options.buildDictContext.get('LamC2i').build.name,
    LAMBDA_APIEXEC_BUILD_PROJECT_NAME: this.options.buildDictContext.get('LamAe').build.name,
    OPERATE_ENV_PROJECT_NAME: this.options.buildDictContext.get('Ope').build.name,
    PR_UPDATE_LABELS_PROJECT_NAME: this.options.buildDictContext.get('UpLa').build.name,
  };

  readonly afterwardPolicyDocument = new iam.DataAwsIamPolicyDocument(this, 'afterwardPolicyDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        resources: this.options.buildDictContext.getAll().map(([_name, build]) => build.build.arn),
        actions: ['codebuild:ListBuildsForProject', 'codebuild:StartBuild', 'codebuild:BatchGetBuilds'],
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
    ],
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy
  readonly afterwardPolicy = new iam.IamPolicy(this, 'afterwardPolicy', {
    namePrefix: this.options.prefix,
    policy: this.afterwardPolicyDocument.json,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy_attachment
  readonly afterwardPolicyAttach = new iam.IamPolicyAttachment(this, 'afterwardPolicyAttach', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    roles: [
      z.string().parse(this.options.bot.ghWebhookExecRole.name),
      z.string().parse(this.options.bot.onAnyExecRole.name),
    ],
    policyArn: this.afterwardPolicy.arn,
  });

  readonly accumuratedBotEnv: AccumuratedBotEnv = {
    ...this.options.sharedEnv,
    ...this.options.bot.computedBotEnv,
    ...this.computedAfterwardBotEnv,
  };

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function
  // TODO(logging): retention
  readonly ghWebhookFunction = new lambdafunction.LambdaFunction(this, 'ghWebhookFunction', {
    functionName: `${this.options.prefix}-github-bot-${this.suffix.result}`,
    s3Bucket: this.options.bot.ghWebhookBucket.bucket,
    s3Key: this.options.bot.githubBotZip.key,
    role: this.options.bot.ghWebhookExecRole.arn,
    memorySize: 1024,
    environment: {
      variables: accumuratedBotEnvSchema.parse(this.accumuratedBotEnv),
    },
    timeout: 20,
    handler: 'github-bot.handler',
    runtime: 'nodejs14.x',

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // TODO(logging): retention
  readonly onAnyFunction = new lambdafunction.LambdaFunction(this, 'onAnyFunction', {
    functionName: `${this.options.prefix}-on-any-${this.suffix.result}`,
    s3Bucket: this.options.bot.ghWebhookBucket.bucket,
    s3Key: this.options.bot.onAnyZip.key,
    role: this.options.bot.onAnyExecRole.arn,
    reservedConcurrentExecutions: 1,
    memorySize: 1024,
    environment: {
      variables: accumuratedBotEnvSchema.parse(this.accumuratedBotEnv),
    },
    timeout: 20,
    handler: 'on-any.handler',
    runtime: 'nodejs14.x',

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // on-any-queue ---->(allow) on-any-lambda
  readonly allowExecutionFromQueue = new lambdafunction.LambdaPermission(this, 'allowExecutionFromQueue', {
    statementId: 'AllowExecutionFromQueue',
    action: 'lambda:InvokeFunction',
    functionName: this.onAnyFunction.functionName,
    principal: 'sns.amazonaws.com',
    sourceArn: this.options.bot.onAnyQueue.arn,
  });

  // on-any-queue --(subscribe)--> on-any-lambda
  readonly onAnyQueueSubscriptionToOnAnyFunction = new lambdafunction.LambdaEventSourceMapping(
    this,
    'onAnyQueueSubscriptionToOnAnyFunction',
    {
      functionName: this.onAnyFunction.arn,
      eventSourceArn: this.options.bot.onAnyQueue.arn,

      dependsOn: [this.allowExecutionFromQueue],
    },
  );

  // api-gw ---->(allow) bot-lambda
  readonly allowApigwToBotFunction = new lambdafunction.LambdaPermission(this, 'allowApigwToBotFunction', {
    statementId: 'AllowExecutionFromAPIGatewayv2',
    action: 'lambda:InvokeFunction',
    functionName: this.ghWebhookFunction.functionName,
    principal: 'apigateway.amazonaws.com',
    sourceArn: `${this.options.bot.api.executionArn}/*/*/*`,
  });

  // api-gw --(subscribe)--> bot-lambda
  readonly integ = new apigatewayv2.Apigatewayv2Integration(this, 'integ', {
    apiId: this.options.bot.api.id,
    integrationType: 'AWS_PROXY',

    // connectionType: 'INTERNET',
    // contentHandlingStrategy: 'CONVERT_TO_TEXT',
    // description: 'Lambda todo',
    integrationMethod: 'POST',
    integrationUri: this.ghWebhookFunction.invokeArn,
    payloadFormatVersion: '2.0',
    // passthroughBehavior: 'WHEN_NO_MATCH',

    dependsOn: [this.allowApigwToBotFunction],
  });

  readonly apiHookRoute = new apigatewayv2.Apigatewayv2Route(this, 'apiHookRoute', {
    apiId: this.options.bot.api.id,
    routeKey: `POST ${this.options.bot.webhookRoute}`,
    target: `integrations/${this.integ.id}`,
  });
}
