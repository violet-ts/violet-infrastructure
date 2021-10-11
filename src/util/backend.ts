// Hard coded for S3.
// Reference: https://github.com/hashicorp/terraform-cdk/blob/main/docs/working-with-cdk-for-terraform/remote-backend.md
// Reference: https://github.com/hashicorp/terraform-cdk/tree/main/examples/typescript/backends/s3

import type { TerraformStack } from 'cdktf';
import { S3Backend } from 'cdktf';

/**
 * @param uniqueName これは、仮に stack が複数の設定で同時に生成されうるとしても競合しない名前を設定します。
 */
export const configureBackend = (stack: TerraformStack, uniqueName: string): void => {
  const { S3BACKEND_REGION, S3BACKEND_BUCKET, S3BACKEND_PROFILE, S3BACKEND_PREFIX } = process.env;
  if (!S3BACKEND_BUCKET) throw new Error('Env var S3BACKEND_BUCKET is required');
  const backend = new S3Backend(stack, {
    region: S3BACKEND_REGION,
    bucket: S3BACKEND_BUCKET,
    profile: S3BACKEND_PROFILE,
    key: `${(S3BACKEND_PREFIX ?? '') + uniqueName}.tfstate`,
  });
  void backend;
};
