import { lambdafunction, s3 } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { StringResource as RandomString } from '@cdktf/provider-random';
import { ensurePath } from '@self/shared/lib/def/util/ensure-path';
import { Fn } from 'cdktf';
import type { Construct } from 'constructs';

export interface ZipLambdaOptions {
  tagsAll?: Record<string, string>;
  prefix: string;
  zipPath: string;
  funcitonOptions: Omit<lambdafunction.LambdaFunctionConfig, 'functionName' | 's3Bucket' | 's3Key' | 'tagsAll'>;
}
export class ZipLambda extends Resource {
  constructor(scope: Construct, name: string, public options: ZipLambdaOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 8,
    lower: true,
    upper: false,
    special: false,
  });

  readonly bucket = new s3.S3Bucket(this, 'bucket', {
    bucketPrefix: `${this.options.prefix}-`,
    acl: 'private',
    forceDestroy: true,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly zipPath = ensurePath(this.options.zipPath);

  readonly zipObject = new s3.S3BucketObject(this, 'zipObject', {
    bucket: this.bucket.bucket,
    key: `${Fn.sha1(Fn.filebase64(this.zipPath))}.zip`,
    source: this.zipPath,
    forceDestroy: true,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly function = new lambdafunction.LambdaFunction(this, 'function', {
    functionName: `${this.options.prefix}-${this.suffix.result}`,
    s3Bucket: this.bucket.bucket,
    s3Key: this.zipObject.key,

    tagsAll: {
      ...this.options.tagsAll,
    },

    ...this.options.funcitonOptions,
  });
}
