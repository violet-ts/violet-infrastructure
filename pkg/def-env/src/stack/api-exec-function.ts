import type { SNS } from '@cdktf/provider-aws';
import { IAM, LambdaFunction } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import type { Construct } from 'constructs';
import { z } from 'zod';
import type { DataNetwork } from './data-network';
import type { HTTPTask } from './http-task';
import type { RepoImage } from './repo-image';

export interface APIExecFunctionOptions {
  prefix: string;
  tagsAll?: Record<string, string>;
  task: HTTPTask;
  network: DataNetwork;
  repoImage: RepoImage;
  botTopic: SNS.DataAwsSnsTopic;

  env: Record<string, string>;
}

export class APIExecFunction extends Resource {
  constructor(scope: Construct, name: string, public options: APIExecFunctionOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

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
      // {
      //   // https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html#vpc-permissions
      //   actions: [
      //     'ec2:CreateNetworkInterface',
      //     'ec2:DescribeNetworkInterfaces',
      //     'ec2:DeleteNetworkInterface',
      //     'ec2:AssignPrivateIpAddresses',
      //     'ec2:UnassignPrivateIpAddresses',
      //   ],
      //   effect: 'Allow',
      //   resources: ['*'],
      //   // https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonec2.html#amazonec2-policy-keys
      //   condition: [
      //     {
      //       test: 'StringEquals',
      //       variable: 'ec2:Vpc',
      //       values: [this.options.network.vpc.arn],
      //     },
      //   ],
      // },
    ],
  });

  readonly role = new IAM.IamRole(this, 'role', {
    name: this.options.prefix,
    assumeRolePolicy: this.roleAssumeDocument.json,
  });

  readonly taskPolicy = new IAM.IamRolePolicy(this, 'taskPolicy', {
    namePrefix: this.options.prefix,
    role: z.string().parse(this.role.name),
    policy: this.options.task.taskPolicyDocument.json,
  });

  readonly lambdaPolicy = new IAM.IamRolePolicy(this, 'lambdaPolicy', {
    namePrefix: this.options.prefix,
    role: z.string().parse(this.role.name),
    policy: this.policyDocument.json,
  });

  readonly function = new LambdaFunction.LambdaFunction(this, 'function', {
    functionName: this.options.prefix,
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
