import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_PREFIX } from '@self/shared/lib/const';

export const devSqsPolicy = (ac: string): PolicySet => ({
  allowResources: [`arn:aws:sqs:*:${ac}:${RESOURCE_DEV_PREFIX}*`],
  allowActions: ['sqs:ListQueues'],
  explicitDeny: ['sqs:Tag*', 'sqs:Untag*', 'sqs:CreateQueue', 'sqs:DeleteQueue'],
});
