import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_SHORT_PREFIX } from '@self/shared/lib/const';

export const devEcsPolicy = (ac: string): PolicySet => ({
  allowResources: [
    `arn:aws:ecs:*:${ac}:container-instance/${RESOURCE_DEV_SHORT_PREFIX}*`,
    `arn:aws:ecs:*:${ac}:capacity-provider/${RESOURCE_DEV_SHORT_PREFIX}*`,
    `arn:aws:ecs:*:${ac}:task-definition/${RESOURCE_DEV_SHORT_PREFIX}*:*`,
    `arn:aws:ecs:*:${ac}:task-set/${RESOURCE_DEV_SHORT_PREFIX}*/*/*`,
    `arn:aws:ecs:*:${ac}:service/${RESOURCE_DEV_SHORT_PREFIX}*`,
    `arn:aws:ecs:*:${ac}:cluster/${RESOURCE_DEV_SHORT_PREFIX}*`,
    `arn:aws:ecs:*:${ac}:task/${RESOURCE_DEV_SHORT_PREFIX}*`,
  ],
  allowActions: [
    'ecs:Discover*',
    'ecs:Describe*',
    'ecs:List*',

    // 'ecs:DiscoverPollEndpoint',
    // "ecs:PutAccountSettingDefault",
    // "ecs:CreateCluster",
    // 'ecs:DescribeTaskDefinition',
    // "ecs:PutAccountSetting",
    // 'ecs:ListServices',
    // "ecs:CreateCapacityProvider",
    // "ecs:DeregisterTaskDefinition",
    // 'ecs:ListAccountSettings',
    // "ecs:DeleteAccountSetting",
    // 'ecs:ListTaskDefinitionFamilies',
    // "ecs:RegisterTaskDefinition",
    // 'ecs:ListTaskDefinitions',
    // "ecs:CreateTaskSet",
    // 'ecs:ListClusters',
  ],
  explicitDeny: ['ecs:Tag*', 'ecs:Untag*', 'ecs:CreateCluster', 'ecs:DeleteCluster'],
});
