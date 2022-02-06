import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';

export const devRoute53Policy = (_ac: string): PolicySet => ({
  allowResources: [],
  allowActions: ['route53:Get*', 'route53:List*'],
  explicitDeny: [],
});
