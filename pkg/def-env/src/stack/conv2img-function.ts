import { IAM, LambdaFunction, S3, SQS } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { Fn } from 'cdktf';
import type { Construct } from 'constructs';
import { z } from 'zod';
import type { DataNetwork } from './data-network';
import type { HTTPTask } from './http-task';
import type { RepoImage } from './repo-image';
import type { ServiceBuckets } from './service-buckets';

// Lambda の処理タイムアウト
const lambdaTimeoutSeconds = 30;
// 処理されきらなかったときに Queue に戻るまでの時間
// Lambda より長くしておく
const visibilityTimeoutSeconds = 35;
// Queue にメッセージを保持しておく期間
const messageRetentionSeconds = 60 * 10; // 10 minutes

export interface Conv2imgFunctionOptions {
  prefix: string;
  tagsAll?: Record<string, string>;
  task: HTTPTask;
  network: DataNetwork;
  repoImage: RepoImage;
  serviceBuckets: ServiceBuckets;

  env: Record<string, string>;
}

export class Conv2imgFunction extends Resource {
  constructor(scope: Construct, name: string, public options: Conv2imgFunctionOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  readonly fromKeyPrefix = 'works/original';

  // TODO(service): pipe to SNS for alarming
  readonly dlq = new SQS.SqsQueue(this, 'dlq', {
    namePrefix: `${this.options.prefix}-dead-`,
    messageRetentionSeconds: 1209600, // 14 days (max)

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_CreateQueue.html
  readonly queue = new SQS.SqsQueue(this, 'queue', {
    namePrefix: `${this.options.prefix}-`,
    messageRetentionSeconds,
    visibilityTimeoutSeconds,
    redrivePolicy: Fn.jsonencode({
      deadLetterTargetArn: this.dlq.arn,
      maxReceiveCount: 10,
    }),

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // queue ---->(allow) dlq (document)
  readonly allowQueueToDLQDoc = new IAM.DataAwsIamPolicyDocument(this, 'allowQueueToDLQDoc', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        principals: [
          {
            type: 'Service',
            identifiers: ['sqs.amazonaws.com'],
          },
        ],
        actions: ['sqs:SendMessage'],
        resources: [this.dlq.arn],
        condition: [
          {
            test: 'ArnEquals',
            variable: 'aws:SourceArn',
            values: [this.queue.arn],
          },
        ],
      },
    ],
  });

  // queue ---->(allow) dlq
  readonly allowQueueToDLQ = new SQS.SqsQueuePolicy(this, 'allowQueueToDLQ', {
    queueUrl: this.dlq.url,
    policy: this.allowQueueToDLQDoc.json,
  });

  // original-bucket ---->(allow) queue (document)
  readonly allowOriginalBucketToQueueDoc = new IAM.DataAwsIamPolicyDocument(this, 'allowOriginalBucketToQueueDoc', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        principals: [
          {
            type: 'Service',
            identifiers: ['s3.amazonaws.com'],
          },
        ],
        actions: ['sqs:SendMessage'],
        resources: [this.queue.arn],
        condition: [
          {
            test: 'ArnEquals',
            variable: 'aws:SourceArn',
            values: [this.options.serviceBuckets.originalBucket.arn],
          },
        ],
      },
    ],
  });

  // original-bucket ---->(allow) queue
  readonly allowOriginalBucketToQueue = new SQS.SqsQueuePolicy(this, 'allowOriginalBucketToQueue', {
    queueUrl: this.queue.url,
    policy: this.allowOriginalBucketToQueueDoc.json,
  });

  // original-bucket --(subscribe)--> queue
  readonly notification = new S3.S3BucketNotification(this, 'notification', {
    bucket: z.string().parse(this.options.serviceBuckets.originalBucket.bucket),
    queue: [
      {
        // https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html#supported-notification-event-types
        queueArn: this.queue.arn,
        events: ['s3:ObjectCreated:*', 's3:ObjectRestore:Completed'],
        filterPrefix: `${this.fromKeyPrefix}/`,
      },
    ],

    dependsOn: [this.allowOriginalBucketToQueue],
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

  readonly policyDocument = new IAM.DataAwsIamPolicyDocument(this, 'policyDocument', {
    version: '2012-10-17',
    statement: [
      {
        // NOTE: 無限ループ回避のために orignal への write を explicit 禁止
        effect: 'Deny',
        resources: [
          this.options.serviceBuckets.originalBucket.arn,
          `${this.options.serviceBuckets.originalBucket.arn}/*`,
        ],
        actions: ['s3:CopyObject', 's3:Put*'],
      },
      {
        effect: 'Allow',
        resources: [
          this.options.serviceBuckets.originalBucket.arn,
          `${this.options.serviceBuckets.originalBucket.arn}/*`,
        ],
        actions: ['s3:Get*', 's3:List*', 's3:HeadObject', 's3:DeleteObject*'],
      },
      {
        effect: 'Allow',
        resources: [
          this.options.serviceBuckets.convertedBucket.arn,
          `${this.options.serviceBuckets.convertedBucket.arn}/*`,
        ],
        actions: ['s3:Get*', 's3:List*', 's3:CopyObject', 's3:Put*', 's3:HeadObject', 's3:DeleteObject*'],
      },
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

  readonly role = new IAM.IamRole(this, 'role', {
    name: this.options.prefix,
    assumeRolePolicy: this.roleAssumeDocument.json,
  });

  readonly lambdaPolicy = new IAM.IamRolePolicy(this, 'lambdaPolicy', {
    namePrefix: this.options.prefix,
    role: z.string().parse(this.role.name),
    policy: this.policyDocument.json,
  });

  // queue (allow)----> (document)
  readonly allowReceiveQueueDoc = new IAM.DataAwsIamPolicyDocument(this, 'allowReceiveQueueDoc', {
    version: '2012-10-17',
    statement: [
      {
        // https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#events-sqs-permissions
        effect: 'Allow',
        resources: [this.queue.arn],
        actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
      },
    ],
  });

  //  queue (allow)----> function
  readonly allowReceiveQueueToFunctionPolicy = new IAM.IamRolePolicy(this, 'allowReceiveQueueToFunctionPolicy', {
    namePrefix: `${this.options.prefix}-`,
    role: z.string().parse(this.role.name),
    policy: this.allowReceiveQueueDoc.json,
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
    timeout: lambdaTimeoutSeconds,

    tagsAll: {
      ...this.options.tagsAll,
    },

    dependsOn: [this.lambdaPolicy],
  });

  // queue ---->(allow) function
  readonly allowExecutionFromQueue = new LambdaFunction.LambdaPermission(this, 'allowExecutionFromQueue', {
    statementId: 'AllowExecutionFromQueue',
    action: 'lambda:InvokeFunction',
    functionName: this.function.functionName,
    principal: 'sns.amazonaws.com',
    sourceArn: this.queue.arn,
  });

  // queue --(subscribe)--> function
  readonly queueSubscriptionToFunction = new LambdaFunction.LambdaEventSourceMapping(
    this,
    'queueSubscriptionToFunction',
    {
      functionName: this.function.arn,
      eventSourceArn: this.queue.arn,

      dependsOn: [this.allowReceiveQueueToFunctionPolicy, this.allowExecutionFromQueue],
    },
  );
}
