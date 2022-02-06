import type { iam } from '@cdktf/provider-aws';

export type Statement = iam.DataAwsIamPolicyDocumentStatement;

export type PolicySet = {
  allowResources: string[];
  allowActions: string[];
  explicitDeny: string[];
};
