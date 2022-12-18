import { iam, lambdafunction } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null/lib/resource';
import { Resource } from '@cdktf/provider-null/lib/resource';
import { StringResource as RandomString } from '@cdktf/provider-random';
import {
  RESOURCE_DEV_IAM_PATH,
  RESOURCE_DEV_SHORT_PREFIX,
  RESOURCE_PROD_IAM_PATH,
  RESOURCE_PROD_SHORT_PREFIX,
} from '@self/shared/lib/const';
import type { ComputedOpEnv } from '@self/shared/lib/operate-env/op-env';
import type { Construct } from 'constructs';
import type { DataNetwork } from './data-network';
import type { HTTPTask } from './http-task';
import type { RepoImage } from './repo-image';
import type { ServiceBuckets } from './service-buckets';

export interface APIExecFunctionOptions {
  prefix: string;
  tagsAll?: Record<string, string>;
  task: HTTPTask;
  network: DataNetwork;
  repoImage: RepoImage;
  serviceBuckets: ServiceBuckets;
  computedOpEnv: ComputedOpEnv;

  env: Record<string, string>;
}

export class APIExecFunction extends Resource {
  constructor(scope: Construct, name: string, public options: APIExecFunctionOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  get shortPrefix(): string {
    return `${
      this.options.computedOpEnv.SECTION === 'development' ? RESOURCE_DEV_SHORT_PREFIX : RESOURCE_PROD_SHORT_PREFIX
    }ae-`;
  }

  get iamPath(): string {
    return `${this.options.computedOpEnv.SECTION === 'development' ? RESOURCE_DEV_IAM_PATH : RESOURCE_PROD_IAM_PATH}`;
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 8,
    lower: true,
    upper: false,
    special: false,
  });

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
        // TODO(security): わからない
        // https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonec2.html#amazonec2-policy-keys
        // condition: [
        //   {
        //     test: 'StringEquals',
        //     variable: 'ec2:Vpc',
        //     values: [this.options.network.vpc.arn],
        //   },
        // ],
      },
    ],
  });

  readonly role = new iam.IamRole(this, 'role', {
    namePrefix: 'apiexec-',
    path: this.iamPath,
    assumeRolePolicy: this.roleAssumeDocument.json,
  });

  readonly taskPolicy = new iam.IamRolePolicy(this, 'taskPolicy', {
    namePrefix: `${this.shortPrefix}task-`,
    role: this.role.name,
    policy: this.options.serviceBuckets.objectsFullAccessPolicyDocument.json,
  });

  readonly lambdaPolicy = new iam.IamRolePolicy(this, 'lambdaPolicy', {
    namePrefix: `${this.shortPrefix}lam-`,
    role: this.role.name,
    policy: this.policyDocument.json,
  });

  readonly function = new lambdafunction.LambdaFunction(this, 'function', {
    functionName: `${this.shortPrefix}ae-${this.suffix.result}`,
    vpcConfig: {
      subnetIds: this.options.network.publicSubnets.map((subnet) => subnet.id),
      securityGroupIds: [this.options.network.serviceSg.id],
    },
    packageType: 'Image',
    role: this.role.arn,
    imageUri: this.options.repoImage.imageUri,
    environment: { variables: this.options.env },
    memorySize: 256,
    timeout: 120,
    dependsOn: [this.taskPolicy, this.lambdaPolicy],
  });
}
