import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_PREFIX } from '@self/shared/lib/const';

export const devSecretsManagerPolicy = (ac: string): PolicySet => ({
  allowResources: [`arn:aws:secretsmanager:*:${ac}:secret:${RESOURCE_DEV_PREFIX}*`],
  allowActions: [
    'secretsmanager:Describe*',

    // 'secretsmanager:DescribeLoadBalancerAttributes',
    // 'secretsmanager:DescribeLoadBalancers',
    // 'secretsmanager:DescribeLoadBalancerPolicies',
    // 'secretsmanager:DescribeLoadBalancerPolicyTypes',
    // 'secretsmanager:DescribeInstanceHealth',
  ],
  explicitDeny: [
    'secretsmanager:Tag*',
    'secretsmanager:Untag*',

    'secretsmanager:Create*',
    'secretsmanager:Delete*',

    'secretsmanager:GetSecretValue',
    'secretsmanager:PutSecretValue',
    'secretsmanager:UpdateSecret',
  ],
});
