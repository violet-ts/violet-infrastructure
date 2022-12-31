import { iam, lambdafunction } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null/lib/resource';
import { Resource } from '@cdktf/provider-null/lib/resource';
import { portalApiBuildDir } from '@self/def-manager/src/stack/values';
import { ZipLambda } from '@self/def-manager/src/stack/zip-lambda';
import {
  RESOURCE_DEV_IAM_PATH,
  RESOURCE_DEV_SHORT_PREFIX,
  RESOURCE_PROD_IAM_PATH,
  RESOURCE_PROD_SHORT_PREFIX,
} from '@self/shared/lib/const';
import type { SharedEnv } from '@self/shared/lib/def/env-vars';
import type { ComputedOpEnv } from '@self/shared/lib/operate-env/op-env';
import type { Construct } from 'constructs';
import path from 'path';

export interface AuthLambdaDefineOptions {
  computedOpEnv: ComputedOpEnv;
  sharedEnv: SharedEnv;
  tagsAll?: Record<string, string>;
}
export class AuthLambdaDefine extends Resource {
  constructor(scope: Construct, name: string, public options: AuthLambdaDefineOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  get shortPrefix(): string {
    return `${
      this.options.computedOpEnv.SECTION === 'development' ? RESOURCE_DEV_SHORT_PREFIX : RESOURCE_PROD_SHORT_PREFIX
    }pauth-d-`;
  }

  get iamPath(): string {
    return `${this.options.computedOpEnv.SECTION === 'development' ? RESOURCE_DEV_IAM_PATH : RESOURCE_PROD_IAM_PATH}`;
  }

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
    ],
  });

  readonly role = new iam.IamRole(this, 'role', {
    namePrefix: 'vio-pauth-d-',
    path: this.iamPath,
    assumeRolePolicy: this.roleAssumeDocument.json,
  });

  readonly lambdaPolicy = new iam.IamRolePolicy(this, 'lambdaPolicy', {
    namePrefix: `${this.shortPrefix}lam-`,
    role: this.role.name,
    policy: this.policyDocument.json,
  });

  readonly lambda = new ZipLambda(this, 'lambda', {
    prefix: 'vio-pauth-d',
    zipPath: path.resolve(portalApiBuildDir, 'define-auth-challenge.zip'),
    funcitonOptions: {
      role: this.role.arn,
      memorySize: 256,
      environment: {
        variables: {},
      },
      timeout: 20,
      handler: 'define-auth-challenge.handler',
      runtime: 'nodejs14.x',
    },
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // cognito ---->(allow) lambda
  readonly allowExecutionFromCognito = new lambdafunction.LambdaPermission(this, 'allowExecutionFromCognito', {
    statementId: 'AllowExecutionFromQueue',
    action: 'lambda:InvokeFunction',
    functionName: this.lambda.function.functionName,
    principal: 'cognito-idp.amazonaws.com',
    // TODO(hardcoded): region
    sourceArn: `arn:aws:cognito-idp:ap-northeast-1:${this.options.sharedEnv.AWS_ACCOUNT_ID}:userpool/*`,
  });
}
