import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_PREFIX } from '@self/shared/lib/const';

export const devEcrPolicy = (ac: string): PolicySet => ({
  allowResources: [`arn:aws:ecr:*:${ac}:repository/${RESOURCE_DEV_PREFIX}*`],
  allowActions: [
    'ecr:Get*',
    'ecr:Describe*',

    // 'ecr:GetRegistryPolicy',
    // 'ecr:DescribeRegistry',
    // 'ecr:DescribePullThroughCacheRules',
    // 'ecr:GetAuthorizationToken',
    // 'ecr:PutRegistryScanningConfiguration',
    // 'ecr:DeleteRegistryPolicy',
    // 'ecr:CreatePullThroughCacheRule',
    // 'ecr:DeletePullThroughCacheRule',
    // 'ecr:PutRegistryPolicy',
    // 'ecr:GetRegistryScanningConfiguration',
    // 'ecr:PutReplicationConfiguration',
  ],
  explicitDeny: ['ecr:Tag*', 'ecr:Untag*', 'ecr:CreateRepository', 'ecr:DeleteRepository', 'ecr:PutImageTagMutability'],
});
