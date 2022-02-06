import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_PREFIX, RESOURCE_PUBLIC_PREFIX } from '@self/shared/lib/const';

export const devS3Policy = (_ac: string): PolicySet => ({
  allowResources: [
    `arn:aws:s3:::${RESOURCE_DEV_PREFIX}*`,
    `arn:aws:s3:::${RESOURCE_DEV_PREFIX}*/*`,
    `arn:aws:s3:::${RESOURCE_DEV_PREFIX}*`,
    `arn:aws:s3:::${RESOURCE_DEV_PREFIX}*/*`,
    `arn:aws:s3:::${RESOURCE_PUBLIC_PREFIX}*`,
    `arn:aws:s3:::${RESOURCE_PUBLIC_PREFIX}*/*`,
  ],
  allowActions: [
    's3:List*',
    's3:Get*',
    's3:CreateJob',

    // 's3:ListStorageLensConfigurations',
    // 's3:ListAccessPointsForObjectLambda',
    // 's3:GetAccessPoint',
    // "s3:PutAccountPublicAccessBlock",
    // 's3:GetAccountPublicAccessBlock',
    // 's3:ListAllMyBuckets',
    // 's3:ListAccessPoints',
    // "s3:PutAccessPointPublicAccessBlock",
    // 's3:ListJobs',
    // "s3:PutStorageLensConfiguration",
    // 's3:ListMultiRegionAccessPoints',
    // 's3:CreateJob',
  ],
  explicitDeny: ['s3:PutBucketTagging', 's3:CreateBucket', 's3:DeleteBucket'],
});
