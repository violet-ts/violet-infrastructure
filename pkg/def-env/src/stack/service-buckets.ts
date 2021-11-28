import { IAM, S3 } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import type { Construct } from 'constructs';

export interface ServiceBucketsOptions {
  // len <= 26
  prefix: string;
  tagsAll?: Record<string, string>;
}

export class ServiceBuckets extends Resource {
  constructor(scope: Construct, name: string, public options: ServiceBucketsOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  readonly originalBucket = new S3.S3Bucket(this, 'originalBucket', {
    // TODO(service): for prod: protection for deletion, versioning
    // TODO(security): for prod: encryption
    // TODO(logging): for prod
    // TODO(cost): for prod: lifecycle
    bucketPrefix: `${this.options.prefix}-orig-`,
    forceDestroy: true,
    grant: [
      {
        type: 'Group',
        uri: 'http://acs.amazonaws.com/groups/global/AllUsers',
        permissions: ['READ'],
      },
    ],
    // TODO(security): restrict CORS
    corsRule: [
      {
        allowedHeaders: ['*'],
        allowedMethods: ['GET', 'PUT', 'POST'],
        allowedOrigins: ['*'],
      },
    ],
  });

  // https://docs.aws.amazon.com/AmazonS3/latest/API/API_Types.html
  readonly convertedBucket = new S3.S3Bucket(this, 'convertedBucket', {
    // TODO(service): for prod: protection for deletion, versioning
    // TODO(security): for prod: encryption
    // TODO(logging): for prod
    // TODO(cost): for prod: lifecycle
    bucketPrefix: `${this.options.prefix}-conv-`,
    forceDestroy: true,
    grant: [
      {
        type: 'Group',
        uri: 'http://acs.amazonaws.com/groups/global/AllUsers',
        permissions: ['READ'],
      },
    ],
    // TODO(security): restrict CORS
    corsRule: [
      {
        allowedHeaders: ['*'],
        allowedMethods: ['GET', 'PUT', 'POST'],
        allowedOrigins: ['*'],
      },
    ],
  });

  readonly objectsFullAccessPolicyDocument = new IAM.DataAwsIamPolicyDocument(this, 'objectsFullAccessPolicyDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        // https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-actions.html
        resources: [
          this.originalBucket.arn,
          `${this.originalBucket.arn}/*`,
          this.convertedBucket.arn,
          `${this.convertedBucket.arn}/*`,
        ],
        actions: ['s3:Get*', 's3:List*', 's3:CopyObject', 's3:Put*', 's3:HeadObject', 's3:DeleteObject*'],
      },
    ],
  });
}
