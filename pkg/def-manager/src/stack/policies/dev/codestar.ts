import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_PREFIX } from '@self/shared/lib/const';

export const devCodestarPolicy = (ac: string): PolicySet => ({
  allowResources: [
    // `arn:aws:iam::*:user/*:username}`,
    `arn:aws:codestar:*:${ac}:project/${RESOURCE_DEV_PREFIX}*`,
  ],
  allowActions: [
    // "codestar:ListUserProfiles",
    // "codestar:DescribeUserProfile",
    'codestar:ListProjects',
    // "codestar:CreateProject",
    // "codestar:VerifyServiceRole"
  ],
  explicitDeny: ['codestar:Tag*', 'codestar:Untag*', 'codestar:Create*', 'codestar:Delete*'],
});
