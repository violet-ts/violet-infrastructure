import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_PREFIX } from '@self/shared/lib/const';

export const devCodestarNotificationsPolicy = (ac: string): PolicySet => ({
  allowResources: [`arn:aws:codestar-notifications:*:${ac}:notificationrule/${RESOURCE_DEV_PREFIX}*`],
  allowActions: [
    'codestar-notifications:List*',

    // 'codestar-notifications:ListEventTypes',
    // 'codestar-notifications:ListTargets',
    // 'codestar-notifications:ListNotificationRules',
    // "codestar-notifications:DeleteTarget"
  ],
  explicitDeny: [
    'codestar-notifications:Tag*',
    'codestar-notifications:Untag*',

    'codestar-notifications:Create*',
    'codestar-notifications:Delete*',
  ],
});
