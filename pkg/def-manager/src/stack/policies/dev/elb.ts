import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_SHORT_PREFIX } from '@self/shared/lib/const';

export const devElbPolicy = (ac: string): PolicySet => ({
  allowResources: [
    // ALB
    `arn:aws:elasticloadbalancing:*:${ac}:loadbalancer/app/${RESOURCE_DEV_SHORT_PREFIX}*`,
  ],
  allowActions: [
    'elasticloadbalancing:Describe*',

    // 'elasticloadbalancing:DescribeLoadBalancerAttributes',
    // 'elasticloadbalancing:DescribeLoadBalancers',
    // 'elasticloadbalancing:DescribeLoadBalancerPolicies',
    // 'elasticloadbalancing:DescribeLoadBalancerPolicyTypes',
    // 'elasticloadbalancing:DescribeInstanceHealth',
  ],
  explicitDeny: [
    'elasticloadbalancing:RemoveTags',
    'elasticloadbalancing:AddTags',

    'elasticloadbalancing:Create*',
    'elasticloadbalancing:Delete*',
  ],
});
