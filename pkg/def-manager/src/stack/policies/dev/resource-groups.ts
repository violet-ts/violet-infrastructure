import type { Statement } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_PREFIX } from '@self/shared/lib/const';

export const devResourceGroupsStatements = (ac: string): Statement[] => [
  {
    effect: 'Allow',
    actions: [
      'resource-groups:GetGroupQuery',
      'resource-groups:GetGroup',
      'resource-groups:GetGroupConfiguration',
      'resource-groups:GetTags',
      'resource-groups:ListGroupResources',
    ],
    resources: [
      //
      `arn:aws:resource-groups:*:${ac}:group/${RESOURCE_DEV_PREFIX}*`,
    ],
  },
  {
    effect: 'Allow',
    actions: [
      //
      'resource-groups:SearchResources',
      'resource-groups:ListGroups',
    ],
    resources: ['*'],
  },
];
