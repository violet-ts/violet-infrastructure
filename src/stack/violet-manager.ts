// eslint-disable-next-line max-classes-per-file
import type { Construct } from 'constructs';
import { TerraformStack } from 'cdktf';
import {
  AwsProvider,
  ResourcegroupsGroup,
  EcrRepository,
  S3Bucket,
  S3BucketObject,
  IamRole,
  IamRolePolicy,
  Apigatewayv2Api,
  Apigatewayv2Integration,
  Apigatewayv2Route,
  Apigatewayv2Stage,
  LambdaFunction,
} from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource, NullProvider } from '@cdktf/provider-null';
import * as path from 'path';
import { RandomProvider, String as RandomString } from '@cdktf/provider-random';
import { PROJECT_NAME } from '../const';

/**
 * - production
 * - development
 *   +- staging
 *   +- preview
 */
export type Section = 'development' | 'preview' | 'staging' | 'production' | 'manage-only';

export interface VioletManagerOptions {
  region: string;
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

interface BotApiOptions {
  suffix: RandomString;
}
class Bot extends Resource {
  constructor(scope: Construct, name: string, options: BotApiOptions, config?: ResourceConfig) {
    super(scope, name, config);

    // =================================================================
    // IAM Role - Lamabda for Violet bot
    // =================================================================
    const botRole = new IamRole(this, 'botRole', {
      name: `violet-bot-${options.suffix.result}`,
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
      tags: genTags(null, 'manage-only'),
    });
    void botRole;

    // =================================================================
    // IAM Role - Lamabda for Violet bot
    // =================================================================
    const botRolePolicy = new IamRolePolicy(this, 'botRolePolicy', {
      role: botRole.name,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Resource: ['*'],
            Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
          },
        ],
      }),
    });
    void botRolePolicy;

    // =================================================================
    // S3 Bucket - Lambda for Violet bot
    // =================================================================
    const botLambdaS3 = new S3Bucket(this, 'botLambdaS3', {
      bucket: `violet-bot-lambda-${options.suffix.result}`,
      tags: genTags(null, 'manage-only'),
    });
    void botLambdaS3;

    const botLambdaNodeInitialZip = new S3BucketObject(this, 'botLambdaNodeInitialZip', {
      bucket: botLambdaS3.bucket,
      key: 'node-initial.zip',
      source: path.resolve(__dirname, '../data/node-initial.zip'),
      tags: genTags(null, 'manage-only'),
    });
    void botLambdaNodeInitialZip;

    // =================================================================
    // Lambda Function - Lambda for Violet bot
    // =================================================================
    const botFunction = new LambdaFunction(this, 'botFunction', {
      functionName: `violet-bot-${options.suffix.result}`,
      s3Bucket: botLambdaS3.bucket,
      s3Key: botLambdaNodeInitialZip.key,
      role: botRole.arn,
      timeout: 20,
      handler: 'lambda.handler',
      runtime: 'nodejs14.x',
      tags: genTags(null, 'manage-only'),
      lifecycle: { ignoreChanges: ['s3_key'] },
    });
    void botFunction;

    // =================================================================
    // API Gateway - Violet GitHub Bot
    // https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid.html
    // =================================================================
    const botApi = new Apigatewayv2Api(this, 'botApi', {
      name: `violet-bot-${options.suffix.result}`,
      protocolType: 'HTTP',
      tags: genTags(null, 'manage-only'),
    });
    void botApi;

    // =================================================================
    // API Gateway V2 Integration - API to Lambda for Violet bot
    // =================================================================
    const botInteg = new Apigatewayv2Integration(this, 'botInteg', {
      apiId: botApi.id,
      integrationType: 'AWS_PROXY',

      // connectionType: 'INTERNET',
      // contentHandlingStrategy: 'CONVERT_TO_TEXT',
      // description: 'Lambda todo',
      integrationMethod: 'POST',
      integrationUri: botFunction.invokeArn,
      payloadFormatVersion: '2.0',
      // passthroughBehavior: 'WHEN_NO_MATCH',
    });
    void botInteg;

    // =================================================================
    // API Gateway V2 Route - API to Lambda for Violet bot
    // =================================================================
    const botApiHookRoute = new Apigatewayv2Route(this, 'botApiHookRoute', {
      apiId: botApi.id,
      routeKey: 'POST /hook',
      target: `integrations/${botInteg.id}`,
    });
    void botApiHookRoute;

    const botApiDefaultStage = new Apigatewayv2Stage(this, 'botApiDefaultStage', {
      apiId: botApi.id,
      name: '$default',
      autoDeploy: true,
      // TODO(logging)
      // accessLogSettings:[{
      //   destinationArn : aws_cloudwatch_log_group.api_gateway_sample.arn,
      //   format          : JSON.stringify({ "requestId" : "$context.requestId", "ip" : "$context.identity.sourceIp", "requestTime" : "$context.requestTime", "httpMethod" : "$context.httpMethod", "routeKey" : "$context.routeKey", "status" : "$context.status", "protocol" : "$context.protocol", "responseLength" : "$context.responseLength" }),
      // }]
    });
    void botApiDefaultStage;
  }
}

export class VioletManagerStack extends TerraformStack {
  get uniqueName(): string {
    return `manager-${this.options.region}`;
  }

  constructor(scope: Construct, name: string, private options: VioletManagerOptions) {
    super(scope, name);

    // =================================================================
    // Null Provider
    // =================================================================
    const nullProvider = new NullProvider(this, 'nullProvider', {});
    void nullProvider;

    // =================================================================
    // Random Provider
    // https://registry.terraform.io/providers/hashicorp/random/latest
    // =================================================================
    const random = new RandomProvider(this, 'random', {});
    void random;

    // =================================================================
    // Random Suffix
    // https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/string
    // =================================================================
    const suffix = new RandomString(this, 'suffix', {
      length: 6,
      lower: true,
      upper: false,
      special: false,
    });
    void suffix;

    // =================================================================
    // AWS Provider
    // =================================================================
    const awsProvider = new AwsProvider(this, 'aws', {
      region: options.region,
      profile: process.env.AWS_PROFILE,
      accessKey: process.env.AWS_ACCESS_KEY,
      secretKey: process.env.AWS_SECRET_KEY,
    });
    void awsProvider;

    // =================================================================
    // Resource Groups
    // -----------------------------------------------------------------
    // Violet プロジェクトすべてのリソース
    // =================================================================
    const allResources = new ResourcegroupsGroup(this, 'allResources', {
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
    void allResources;

    // =================================================================
    // Resource Groups
    // -----------------------------------------------------------------
    // Violet Manager のリソース
    // =================================================================
    const managerResources = new ResourcegroupsGroup(this, 'managerResources', {
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
    void managerResources;

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
    const { ECR_API_PROD_NAME } = process.env;
    if (typeof ECR_API_PROD_NAME !== 'string') throw new TypeError('ECR_API_PROD_NAME is not string');
    const ecsRepoProdFrontend = new EcrRepository(this, 'ecsRepoProdFrontend', {
      name: ECR_API_PROD_NAME,
      imageTagMutability: 'IMMUTABLE',
      // TODO(security): for production
      // imageScanningConfiguration,
      tags: genTags(null),
    });
    void ecsRepoProdFrontend;

    // -----------------------------------------------------------------
    // ECS Repository - Development API
    // -----------------------------------------------------------------
    const { ECR_API_DEV_NAME } = process.env;
    if (typeof ECR_API_DEV_NAME !== 'string') throw new TypeError('ECR_API_DEV_NAME is not string');
    const ecsRepoDevFrontend = new EcrRepository(this, 'ecsRepoDevFrontend', {
      name: ECR_API_DEV_NAME,
      imageTagMutability: 'MUTABLE',
      // TODO(security): for production
      // imageScanningConfiguration,
      tags: genTags(null, 'development'),
    });
    void ecsRepoDevFrontend;

    const bot = new Bot(this, 'bot', { suffix });
    void bot;
  }
}
