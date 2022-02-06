import type { iam } from '@cdktf/provider-aws';
import { PROJECT_NAME } from '@self/shared/lib/const';

type Statement = iam.DataAwsIamPolicyDocumentStatement;

export const denyProdStatements = (_ac: string): Statement[] => [
  {
    effect: 'Deny',
    actions: ['*'],
    resources: ['*'],
    condition: [
      {
        test: 'StringNotEqualsIfExists',
        variable: 'aws:ResourceTag/Project',
        values: [PROJECT_NAME],
      },
    ],
  },
  {
    effect: 'Deny',
    actions: ['*'],
    resources: ['*'],
    condition: [
      {
        test: 'StringNotEqualsIfExists',
        variable: 'aws:ResourceTag/Section',
        values: ['development', 'preview'],
      },
    ],
  },
];
