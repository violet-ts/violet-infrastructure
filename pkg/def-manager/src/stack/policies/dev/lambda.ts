import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_SHORT_PREFIX } from '@self/shared/lib/const';

export const devLambdaPolicy = (ac: string): PolicySet => ({
  allowResources: [
    // `arn:aws:iam::*:user/*:username}`,
    `arn:aws:lambda:*:${ac}:layer:${RESOURCE_DEV_SHORT_PREFIX}*`,
    `arn:aws:lambda:*:${ac}:layer:${RESOURCE_DEV_SHORT_PREFIX}*:*`,
    `arn:aws:lambda:*:${ac}:function:${RESOURCE_DEV_SHORT_PREFIX}*`,
    `arn:aws:lambda:*:${ac}:function:${RESOURCE_DEV_SHORT_PREFIX}*:*`,
    // `arn:aws:lambda:*:${ac}:event-source-mapping:*`,
    // `arn:aws:lambda:*:${ac}:code-signing-config:*`,
  ],
  allowActions: [
    'lambda:List*',

    // 'lambda:ListFunctions',
    // 'lambda:ListEventSourceMappings',
    // 'lambda:ListLayerVersions',
    // 'lambda:ListLayers',
    // 'lambda:GetAccountSettings',
    // "lambda:CreateEventSourceMapping",
    // 'lambda:ListCodeSigningConfigs',
  ],
  explicitDeny: ['lambda:TagResource', 'lambda:UntagResource', 'lambda:Create*', 'lambda:Delete*'],
});
