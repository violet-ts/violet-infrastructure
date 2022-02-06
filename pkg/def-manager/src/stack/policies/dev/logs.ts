import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_PREFIX } from '@self/shared/lib/const';

export const devLogsPolicy = (ac: string): PolicySet => ({
  allowResources: [
    `arn:aws:logs:*:${ac}:log-group:${RESOURCE_DEV_PREFIX}*:log-stream:*`,
    // 'arn:aws:logs:*:${ac}:destination:*',
  ],
  allowActions: [
    'logs:Describe*',
    'logs:Get*',
    'logs:List*',

    // 'logs:DescribeQueries',
    // 'logs:GetLogRecord',
    // "logs:PutDestinationPolicy",
    // 'logs:StopQuery',
    // 'logs:TestMetricFilter',
    // "logs:DeleteDestination",
    // "logs:DeleteQueryDefinition",
    // "logs:PutQueryDefinition",
    // 'logs:GetLogDelivery',
    // 'logs:ListLogDeliveries',
    // 'logs:CreateLogDelivery',
    // "logs:DeleteResourcePolicy",
    // "logs:PutResourcePolicy",
    // 'logs:DescribeExportTasks',
    // 'logs:GetQueryResults',
    // 'logs:UpdateLogDelivery',
    // "logs:CancelExportTask",
    // "logs:DeleteLogDelivery",
    // 'logs:DescribeQueryDefinitions',
    // "logs:PutDestination",
    // 'logs:DescribeResourcePolicies',
    // 'logs:DescribeDestinations',
  ],
  explicitDeny: ['logs:Tag*', 'logs:Untag*', 'logs:Create*', 'logs:Delete*'],
});
