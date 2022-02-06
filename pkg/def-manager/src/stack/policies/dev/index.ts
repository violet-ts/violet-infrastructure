import { devAcmPolicy } from '@self/def-manager/src/stack/policies/dev/acm';
import { devCloudwatchPolicy } from '@self/def-manager/src/stack/policies/dev/cloudwatch';
import { devCodebuildPolicy } from '@self/def-manager/src/stack/policies/dev/codebuild';
import { devCodestarPolicy } from '@self/def-manager/src/stack/policies/dev/codestar';
import { devCodestarNotificationsPolicy } from '@self/def-manager/src/stack/policies/dev/codestar-notifications';
import { devEcrPolicy } from '@self/def-manager/src/stack/policies/dev/ecr';
import { devEcsPolicy } from '@self/def-manager/src/stack/policies/dev/ecs';
import { devElbPolicy } from '@self/def-manager/src/stack/policies/dev/elb';
import { devLambdaPolicy } from '@self/def-manager/src/stack/policies/dev/lambda';
import { devLogsPolicy } from '@self/def-manager/src/stack/policies/dev/logs';
import { devRdsPolicy } from '@self/def-manager/src/stack/policies/dev/rds';
import { devResourceGroupsStatements } from '@self/def-manager/src/stack/policies/dev/resource-groups';
import { devRoute53Policy } from '@self/def-manager/src/stack/policies/dev/route53';
import { devS3Policy } from '@self/def-manager/src/stack/policies/dev/s3';
import { devSecretsManagerPolicy } from '@self/def-manager/src/stack/policies/dev/secretsmanager';
import { devSnsPolicy } from '@self/def-manager/src/stack/policies/dev/sns';
import type { PolicySet, Statement } from '@self/def-manager/src/stack/policies/dev/types';

const devPolicies = (ac: string): PolicySet[] => [
  devEcrPolicy(ac),
  devCloudwatchPolicy(ac),
  devLogsPolicy(ac),
  devEcsPolicy(ac),
  devRdsPolicy(ac),
  devS3Policy(ac),
  devCodebuildPolicy(ac),
  devSnsPolicy(ac),
  devCodestarPolicy(ac),
  devCodestarNotificationsPolicy(ac),
  devElbPolicy(ac),
  devSecretsManagerPolicy(ac),
  devAcmPolicy(ac),
  devRoute53Policy(ac),
  devLambdaPolicy(ac),
];

const devPolicySet = (ac: string): PolicySet => {
  const policies = devPolicies(ac);
  return {
    allowActions: policies.flatMap((p) => p.allowActions),
    allowResources: policies.flatMap((p) => p.allowResources),
    explicitDeny: policies.flatMap((p) => p.explicitDeny),
  };
};

export const devStatements = (ac: string): Statement[] => [
  ...devResourceGroupsStatements(ac),
  {
    effect: 'Allow',
    actions: ['*'],
    resources: devPolicySet(ac).allowResources,
  },
  {
    effect: 'Allow',
    actions: devPolicySet(ac).allowActions,
    resources: ['*'],
  },
  {
    effect: 'Deny',
    actions: devPolicySet(ac).explicitDeny,
    resources: ['*'],
  },
];
