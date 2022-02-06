import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_PREFIX } from '@self/shared/lib/const';

export const devSnsPolicy = (ac: string): PolicySet => ({
  allowResources: [`arn:aws:sns:*:${ac}:${RESOURCE_DEV_PREFIX}*`],
  allowActions: [
    'sns:ListTopics',
    // "sns:Unsubscribe",
    // "sns:CreatePlatformEndpoint",
    // "sns:OptInPhoneNumber",
    // "sns:CheckIfPhoneNumberIsOptedOut",
    // "sns:ListEndpointsByPlatformApplication",
    // "sns:SetEndpointAttributes",
    // "sns:DeletePlatformApplication",
    // "sns:SetPlatformApplicationAttributes",
    // "sns:VerifySMSSandboxPhoneNumber",
    // "sns:DeleteSMSSandboxPhoneNumber",
    // "sns:ListSMSSandboxPhoneNumbers",
    // "sns:CreatePlatformApplication",
    // "sns:SetSMSAttributes",
    // "sns:GetPlatformApplicationAttributes",
    // "sns:GetSubscriptionAttributes",
    'sns:ListSubscriptions',
    // "sns:ListOriginationNumbers",
    // "sns:DeleteEndpoint",
    // "sns:ListPhoneNumbersOptedOut",
    // "sns:GetEndpointAttributes",
    // "sns:SetSubscriptionAttributes",
    // "sns:GetSMSSandboxAccountStatus",
    // "sns:CreateSMSSandboxPhoneNumber",
    // "sns:ListPlatformApplications",
    // "sns:GetSMSAttributes"
  ],
  explicitDeny: ['sns:Tag*', 'sns:Untag*', 'sns:CreateTopic', 'sns:DeleteTopic'],
});
