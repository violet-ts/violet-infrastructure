import type { PolicySet } from '@self/def-manager/src/stack/policies/dev/types';
import { RESOURCE_DEV_PREFIX } from '@self/shared/lib/const';

export const devCloudwatchPolicy = (ac: string): PolicySet => ({
  allowResources: [
    `arn:aws:cloudwatch::${ac}:dashboard/${RESOURCE_DEV_PREFIX}*`,
    // 'arn:aws:cloudwatch:*:${ac}:insight-rule/*',
    // 'arn:aws:cloudwatch:*:${ac}:metric-stream/*',
    // 'arn:aws:cloudwatch:*:${ac}:alarm:*',
  ],
  allowActions: [
    'cloudwatch:Get*',
    'cloudwatch:Describe*',
    'cloudwatch:List*',

    // 'cloudwatch:DescribeInsightRules',
    // "cloudwatch:PutMetricData",
    // 'cloudwatch:GetMetricData',
    // 'cloudwatch:ListMetricStreams',
    // 'cloudwatch:DescribeAlarmsForMetric',
    // 'cloudwatch:ListDashboards',
    // "cloudwatch:PutAnomalyDetector",
    // 'cloudwatch:GetMetricStatistics',
    // 'cloudwatch:GetMetricWidgetImage',
    // "cloudwatch:DeleteAnomalyDetector",
    // 'cloudwatch:ListMetrics',
    // 'cloudwatch:DescribeAnomalyDetectors',
  ],
  explicitDeny: ['cloudwatch:Tag*', 'cloudwatch:Untag*', 'cloudwatch:Create*', 'cloudwatch:Delete*'],
});
