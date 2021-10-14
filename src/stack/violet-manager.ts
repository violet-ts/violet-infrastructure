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
  CodebuildProject,
} from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource, NullProvider } from '@cdktf/provider-null';
import * as path from 'path';
import { RandomProvider, String as RandomString } from '@cdktf/provider-random';
import { PROJECT_NAME } from '../const';
import type { SharedEnv, DevEnv, ProdEnv } from '../util/env-vars';

/**
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
          // TODO(extended): not supported private repos
          // IMAGE_TAG
          // GIT_URL
          // GIT_REV
        ],
      },
    ],
    source: [
      {
        type: 'NO_SOURCE',
      },
    ],
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
}

interface BotApiOptions extends VioletManagerOptions {
  suffix: RandomString;
  devApiBuild: DevApiBuild;
}
class Bot extends Resource {
  private tags = genTags(null, 'manage-only');

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
  // IAM Role - Lamabda for Violet bot
  // =================================================================
  botRolePolicy = new IamRolePolicy(this, 'botRolePolicy', {
    role: this.botRole.name,
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
          Resource: [this.options.devApiBuild.apiBuild.arn],
          Action: ['codebuild:ListProjects', 'codebuild:ListBuildsForProject', 'codebuild:StartBuild'],
        },
      ],
    }),
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

  constructor(scope: Construct, name: string, private options: BotApiOptions, config?: ResourceConfig) {
    super(scope, name, config);
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
      profile: options.sharedEnv.AWS_PROFILE,
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
    const ecsRepoProdFrontend = new EcrRepository(this, 'ecsRepoProdFrontend', {
      name: options.prodEnv.ECR_API_PROD_NAME,
      imageTagMutability: 'IMMUTABLE',
      // TODO(security): for production
      // imageScanningConfiguration,
      tags: genTags(null),
    });
    void ecsRepoProdFrontend;

    // -----------------------------------------------------------------
    // ECS Repository - Development API
    // -----------------------------------------------------------------
    const ecsRepoDevFrontend = new EcrRepository(this, 'ecsRepoDevFrontend', {
      name: options.devEnv.ECR_API_DEV_NAME,
      imageTagMutability: 'MUTABLE',
      // TODO(security): for production
      // imageScanningConfiguration,
      tags: genTags(null, 'development'),
    });
    void ecsRepoDevFrontend;

    const devApiBuild = new DevApiBuild(this, 'devApiBuild', { ...options, suffix, name: `violet-dev-build-api` });
    void devApiBuild;

    const bot = new Bot(this, 'bot', { ...options, suffix, devApiBuild });
    void bot;
  }
}
