import type { ecs } from '@cdktf/provider-aws';
import { cloudwatch } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { StringResource as RandomString } from '@cdktf/provider-random';
import { RESOURCE_DEV_SHORT_PREFIX, RESOURCE_PROD_SHORT_PREFIX } from '@self/shared/lib/const';
import type { ComputedOpEnv } from '@self/shared/lib/operate-env/op-env';
import type { Construct } from 'constructs';
import type { APIExecFunction } from './api-exec-function';
import type { Conv2imgFunction } from './conv2img-function';
import type { HTTPTask } from './http-task';
import type { MysqlDb } from './mysql';
import type { RepoImage } from './repo-image';
import type { ServiceBuckets } from './service-buckets';

export interface MainDashboardOptions {
  serviceBuckets: ServiceBuckets;
  serviceMysql: MysqlDb;
  conv2imgFunction: Conv2imgFunction;
  apiExecFunction: APIExecFunction;
  cluster: ecs.EcsCluster;
  apiTask: HTTPTask;
  webTask: HTTPTask;
  lambdaApiexecRepoImage: RepoImage;
  lambdaConv2imgRepoImage: RepoImage;
  webRepoImage: RepoImage;
  apiRepoImage: RepoImage;
  computedOpEnv: ComputedOpEnv;
}

export class MainDashboard extends Resource {
  constructor(scope: Construct, name: string, public options: MainDashboardOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  get shortPrefix(): string {
    return `${
      this.options.computedOpEnv.SECTION === 'development' ? RESOURCE_DEV_SHORT_PREFIX : RESOURCE_PROD_SHORT_PREFIX
    }`;
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 8,
    lower: true,
    upper: false,
    special: false,
  });

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

  readonly dashboard = new cloudwatch.CloudwatchDashboard(this, 'dashboard', {
    dashboardName: `${this.shortPrefix}${this.suffix.result}`,
    dashboardBody: JSON.stringify(this.dashboardBody),
  });
}
