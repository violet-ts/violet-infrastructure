import { iam, lambdafunction } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
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
import type { CreateAuthChallengeEnv } from '@self/shared/lib/portal/auth/env';
import { createAuthChallengeEnvSchema } from '@self/shared/lib/portal/auth/env';
import type { Construct } from 'constructs';
import path from 'path';

export interface AuthLambdaCreateOptions {
  computedOpEnv: ComputedOpEnv;
  sharedEnv: SharedEnv;
  tagsAll?: Record<string, string>;
}
export class AuthLambdaCreate extends Resource {
  constructor(scope: Construct, name: string, public options: AuthLambdaCreateOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  get shortPrefix(): string {
    return `${
      this.options.computedOpEnv.SECTION === 'development' ? RESOURCE_DEV_SHORT_PREFIX : RESOURCE_PROD_SHORT_PREFIX
    }pauth-c-`;
  }

  get iamPath(): string {
    return `${this.options.computedOpEnv.SECTION === 'development' ? RESOURCE_DEV_IAM_PATH : RESOURCE_PROD_IAM_PATH}`;
  }

  readonly createAuthChallengeEnv: CreateAuthChallengeEnv = {
    SES_FROM_ADDRESS: 'noreply@email.a.violet-dev.com',
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
      {
        actions: ['ses:SendEmail'],
        effect: 'Allow',
        resources: ['*'],
        condition: [
          {
            variable: 'ses:FromAddress',
            test: 'StringEquals',
            values: ['noreply@email.a.violet-dev.com'],
          },
        ],
      },
    ],
  });

  readonly role = new iam.IamRole(this, 'role', {
    namePrefix: 'vio-pauth-c-',
    path: this.iamPath,
    assumeRolePolicy: this.roleAssumeDocument.json,
  });

  readonly lambdaPolicy = new iam.IamRolePolicy(this, 'lambdaPolicy', {
    namePrefix: `${this.shortPrefix}lam-`,
    role: this.role.name,
    policy: this.policyDocument.json,
  });

  readonly lambda = new ZipLambda(this, 'lambda', {
    prefix: 'vio-pauth-c',
    zipPath: path.resolve(portalApiBuildDir, 'create-auth-challenge.zip'),
    funcitonOptions: {
      role: this.role.arn,
      memorySize: 256,
      environment: {
        variables: createAuthChallengeEnvSchema.parse(this.createAuthChallengeEnv),
      },
      timeout: 20,
      handler: 'create-auth-challenge.handler',
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
