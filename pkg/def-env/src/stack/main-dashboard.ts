import type { ECS } from '@cdktf/provider-aws';
import { CloudWatch } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import type { Construct } from 'constructs';
import type { APIExecFunction } from './api-exec-function';
import type { Conv2imgFunction } from './conv2img-function';
import type { HTTPTask } from './http-task';
import type { MysqlDb } from './mysql';
import type { RepoImage } from './repo-image';
import type { ServiceBuckets } from './service-buckets';

export interface MainDashboardOptions {
  name: string;
  serviceBuckets: ServiceBuckets;
  serviceMysql: MysqlDb;
  conv2imgFunction: Conv2imgFunction;
  apiExecFunction: APIExecFunction;
  cluster: ECS.EcsCluster;
  apiTask: HTTPTask;
  webTask: HTTPTask;
  lambdaApiexecRepoImage: RepoImage;
  lambdaConv2imgRepoImage: RepoImage;
  webRepoImage: RepoImage;
  apiRepoImage: RepoImage;
}

export class MainDashboard extends Resource {
  constructor(scope: Construct, name: string, public options: MainDashboardOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  readonly dashboardBody = {
    widgets: [
      {
        height: 6,
        width: 24,
        y: 0,
        x: 0,
        type: 'metric',
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [
              'AWS/S3',
              'BucketSizeBytes',
              'StorageType',
              'StandardStorage',
              'BucketName',
              this.options.serviceBuckets.originalBucket.bucket,
              {
                period: 86400,
              },
            ],
            [
              '.',
              'NumberOfObjects',
              '.',
              'AllStorageTypes',
              '.',
              '.',
              {
                period: 86400,
              },
            ],
          ],
          region: this.options.serviceBuckets.originalBucket.region,
          title: 'S3: Public Original',
        },
      },
      {
        height: 6,
        width: 24,
        y: 6,
        x: 0,
        type: 'metric',
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [
              'AWS/S3',
              'BucketSizeBytes',
              'StorageType',
              'StandardStorage',
              'BucketName',
              this.options.serviceBuckets.convertedBucket.bucket,
              {
                period: 86400,
              },
            ],
            [
              '.',
              'NumberOfObjects',
              '.',
              'AllStorageTypes',
              '.',
              '.',
              {
                period: 86400,
              },
            ],
          ],
          region: this.options.serviceBuckets.convertedBucket.region,
          title: 'S3: Public Converted',
        },
      },
      {
        height: 6,
        width: 12,
        y: 12,
        x: 0,
        type: 'metric',
        properties: {
          metrics: [
            [
              'AWS/ECR',
              'RepositoryPullCount',
              'RepositoryName',
              this.options.apiRepoImage.repo.name,
              {
                label: 'API',
              },
            ],
            [
              '...',
              this.options.lambdaApiexecRepoImage.repo.name,
              {
                label: 'Lambda API Exec',
              },
            ],
            [
              '...',
              this.options.lambdaConv2imgRepoImage.repo.name,
              {
                label: 'Lambda Conv2Img',
              },
            ],
            [
              '...',
              this.options.webRepoImage.repo.name,
              {
                label: 'Web',
              },
            ],
          ],
          view: 'timeSeries',
          stacked: false,
          region: 'ap-northeast-1',
          stat: 'Average',
          period: 300,
          title: 'ECR: 各イメージのPull回数',
        },
      },
      {
        height: 6,
        width: 12,
        y: 12,
        x: 12,
        type: 'metric',
        properties: {
          metrics: [
            [
              'AWS/ECS',
              'CPUUtilization',
              'ServiceName',
              this.options.apiTask.service.name,
              'ClusterName',
              this.options.cluster.name,
              {
                label: 'API CPU使用率',
              },
            ],
            [
              '...',
              this.options.webTask.service.name,
              '.',
              '.',
              {
                label: 'Web CPU使用率',
              },
            ],
            [
              '.',
              'MemoryUtilization',
              '.',
              this.options.apiTask.service.name,
              '.',
              '.',
              {
                label: 'API メモリ使用率',
              },
            ],
            [
              '...',
              this.options.webTask.service.name,
              '.',
              '.',
              {
                label: 'Web メモリ使用率',
              },
            ],
          ],
          view: 'timeSeries',
          stacked: false,
          region: 'ap-northeast-1',
          stat: 'Average',
          period: 300,
          title: 'ECS: CPU/メモリ使用率一覧',
        },
      },
      {
        height: 6,
        width: 12,
        y: 18,
        x: 0,
        type: 'metric',
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [['AWS/SQS', 'NumberOfMessagesReceived', 'QueueName', this.options.conv2imgFunction.queue.name]],
          region: 'ap-northeast-1',
          title: 'SQS: Conv2Img 受け取った数',
        },
      },
      {
        height: 6,
        width: 12,
        y: 18,
        x: 12,
        type: 'metric',
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [['AWS/SQS', 'NumberOfMessagesReceived', 'QueueName', this.options.conv2imgFunction.dlq.name]],
          region: 'ap-northeast-1',
          title: 'SQS: Conv2Img DLQ 受け取った数',
        },
      },
      {
        type: 'metric',
        x: 0,
        y: 24,
        width: 8,
        height: 6,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [['AWS/RDS', 'FreeStorageSpace', 'DBInstanceIdentifier', this.options.serviceMysql.db.identifier]],
          region: 'ap-northeast-1',
          title: 'RDS: サービスMySQL/空きストレージ容量',
        },
      },
      {
        height: 6,
        width: 8,
        x: 8,
        y: 24,
        type: 'metric',
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            ['AWS/RDS', 'DatabaseConnections', 'DBInstanceIdentifier', this.options.serviceMysql.db.identifier],
          ],
          region: 'ap-northeast-1',
          title: 'RDS: サービスMySQL/コネクション数',
        },
      },
      {
        type: 'metric',
        x: 16,
        y: 24,
        width: 8,
        height: 6,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [['AWS/RDS', 'SwapUsage', 'DBInstanceIdentifier', this.options.serviceMysql.db.identifier]],
          region: 'ap-northeast-1',
        },
      },
    ],
  };

  readonly dashboard = new CloudWatch.CloudwatchDashboard(this, 'dashboard', {
    dashboardName: this.options.name,
    // dashboardBody: Fn.jsonencode(this.dashboardBody),
    dashboardBody: JSON.stringify(this.dashboardBody),
  });
}
