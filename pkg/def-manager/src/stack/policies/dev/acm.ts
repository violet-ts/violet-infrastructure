import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';

export const devAcmPolicy = (_ac: string): PolicySet => ({
  allowResources: [],
  allowActions: [
    // "acm:GetAccountConfiguration",
    // "acm:RequestCertificate",
    // "acm:PutAccountConfiguration",
    'acm:ListCertificates',
  ],
  explicitDeny: [],
});
