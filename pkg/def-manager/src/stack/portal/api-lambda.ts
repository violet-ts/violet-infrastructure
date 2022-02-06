import { apigatewayv2, iam, lambdafunction } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { StringResource as RandomString } from '@cdktf/provider-random';
import { portalApiBuildDir } from '@self/def-manager/src/stack/values';
import { ZipLambda } from '@self/def-manager/src/stack/zip-lambda';
import {
  RESOURCE_DEV_IAM_PATH,
  RESOURCE_DEV_SHORT_PREFIX,
  RESOURCE_PROD_IAM_PATH,
  RESOURCE_PROD_SHORT_PREFIX,
} from '@self/shared/lib/const';
import type { ComputedOpEnv } from '@self/shared/lib/operate-env/op-env';
import type { PortalEnv } from '@self/shared/lib/portal/lambda/env';
import { portalEnvSchema } from '@self/shared/lib/portal/lambda/env';
import type { Construct } from 'constructs';
import path from 'path';

export interface ApiLambdaeOptions {
  computedOpEnv: ComputedOpEnv;
  tableName: string;
  userPoolId: string;
  userPoolWebClientId: string;
  devGroupName: string;
  tagsAll?: Record<string, string>;
}
export class ApiLambda extends Resource {
  constructor(scope: Construct, name: string, public options: ApiLambdaeOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 8,
    lower: true,
    upper: false,
    special: false,
  });

  get shortPrefix(): string {
    return `${
      this.options.computedOpEnv.SECTION === 'development' ? RESOURCE_DEV_SHORT_PREFIX : RESOURCE_PROD_SHORT_PREFIX
    }pauth-c-`;
  }

  get iamPath(): string {
    return `${this.options.computedOpEnv.SECTION === 'development' ? RESOURCE_DEV_IAM_PATH : RESOURCE_PROD_IAM_PATH}`;
  }

  readonly env: PortalEnv = {
    PORTAL_TABLE_NAME: this.options.tableName,
    PORTAL_USER_POOL_ID: this.options.userPoolId,
    PORTAL_USER_POOL_WEB_CLIENT_ID: this.options.userPoolWebClientId,
    PORTAL_IAM_DEV_GROUP: this.options.devGroupName,
  };

  readonly roleAssumeDocument = new iam.DataAwsIamPolicyDocument(this, 'roleAssumeDocument', {
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

  readonly policyDocument = new iam.DataAwsIamPolicyDocument(this, 'policyDocument', {
    version: '2012-10-17',
    statement: [
      // TODO(security): restrict
      {
        effect: 'Allow',
        resources: ['*'],
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      },
      {
        // https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html#vpc-permissions
        actions: [
          'ec2:CreateNetworkInterface',
          'ec2:DescribeNetworkInterfaces',
          'ec2:DeleteNetworkInterface',
          'ec2:AssignPrivateIpAddresses',
          'ec2:UnassignPrivateIpAddresses',
        ],
        effect: 'Allow',
        resources: ['*'],
      },
      // TODO(security): restrict
      {
        actions: ['iam:*'],
        effect: 'Allow',
        resources: ['*'],
      },
      {
        actions: ['cognito-idp:*'],
        effect: 'Allow',
        resources: ['*'],
      },
      {
        actions: ['dynamodb:*'],
        effect: 'Allow',
        resources: ['*'],
      },
    ],
  });

  readonly role = new iam.IamRole(this, 'role', {
    namePrefix: 'vio-papi-',
    path: this.iamPath,
    assumeRolePolicy: this.roleAssumeDocument.json,
  });

  readonly lambdaPolicy = new iam.IamRolePolicy(this, 'lambdaPolicy', {
    namePrefix: `${this.shortPrefix}lam-`,
    role: this.role.name,
    policy: this.policyDocument.json,
  });

  readonly lambda = new ZipLambda(this, 'lambda', {
    prefix: 'vio-papi',
    zipPath: path.resolve(portalApiBuildDir, 'lambda.zip'),
    funcitonOptions: {
      role: this.role.arn,
      memorySize: 256,
      environment: {
        variables: portalEnvSchema.parse(this.env),
      },
      timeout: 30,
      handler: 'lambda.handler',
      runtime: 'nodejs14.x',
    },
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid.html
  readonly api = new apigatewayv2.Apigatewayv2Api(this, 'api', {
    name: `vio-man-portal-${this.suffix.result}`,
    protocolType: 'HTTP',
    corsConfiguration: {
      allowOrigins: ['*'],
      allowHeaders: ['*'],
      allowMethods: ['HEAD', 'GET', 'POST', 'OPTIONS', 'DELETE', 'PUT', 'PATCH'],
    },

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly apiDefaultStage = new apigatewayv2.Apigatewayv2Stage(this, 'apiDefaultStage', {
    apiId: this.api.id,
    name: '$default',
    autoDeploy: true,
    // TODO(logging): todo
    // accessLogSettings: {
    // },

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // api-gw ---->(allow) lambda
  readonly allowApigwToFunction = new lambdafunction.LambdaPermission(this, 'allowApigwToBotFunction', {
    statementId: 'AllowExecutionFromAPIGatewayv2',
    action: 'lambda:InvokeFunction',
    functionName: this.lambda.function.functionName,
    principal: 'apigateway.amazonaws.com',
    sourceArn: `${this.api.executionArn}/*/*/*`,
  });

  // api-gw --(subscribe)--> lambda
  readonly integ = new apigatewayv2.Apigatewayv2Integration(this, 'integ', {
    apiId: this.api.id,
    integrationType: 'AWS_PROXY',

    // connectionType: 'INTERNET',
    // contentHandlingStrategy: 'CONVERT_TO_TEXT',
    // description: 'Lambda todo',
    integrationMethod: 'POST',
    integrationUri: this.lambda.function.invokeArn,
    payloadFormatVersion: '2.0',
    // passthroughBehavior: 'WHEN_NO_MATCH',

    dependsOn: [this.allowApigwToFunction],
  });

  readonly apiHookRoute = new apigatewayv2.Apigatewayv2Route(this, 'apiHookRoute', {
    apiId: this.api.id,
    routeKey: 'ANY /{proxy+}',
    target: `integrations/${this.integ.id}`,
  });
}
