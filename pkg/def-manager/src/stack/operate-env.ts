import { SNS, IAM, CodeBuild, CodeStar, S3, CloudWatch } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import * as path from 'path';
import * as z from 'zod';
import type { ComputedOpEnv } from '@self/shared/lib/operate-env/op-env';
import { computedOpCodeBuildEnv } from '@self/shared/lib/operate-env/op-env';
import { ensurePath } from '@self/shared/lib/def/util/ensure-path';
import type { VioletManagerStack } from '.';
import { dataDir } from './values';
import { DevNetwork } from './dev-network';

export interface EnvDeployOptions {
  tagsAll: Record<string, string>;
  prefix: string;
  logsPrefix: string;
}

/**
 * 一つの環境を terraform で deploy/destroy するための CodeBuild Project とその関連
 */
export class OperateEnv extends Resource {
  constructor(
    public parent: VioletManagerStack,
    name: string,
    public options: EnvDeployOptions,
    config?: ResourceConfig,
  ) {
    super(parent, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  // TODO
  // TODO: https://github.com/hashicorp/terraform-provider-aws/issues/13587
  readonly cachename = `${this.options.prefix}-cache`;

  // TODO(cost): lifecycle
  readonly cache = new S3.S3Bucket(this, 'cache', {
    // TODO
    bucket: this.cachename,
    // bucket: `${this.options.prefix}-cache-${this.suffix.result}`,
    acl: 'private',
    forceDestroy: true,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly tfstate = new S3.S3Bucket(this, 'tfstate', {
    bucket: `${this.options.prefix}-tfstate-${this.suffix.result}`,
    acl: 'private',
    forceDestroy: true,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly buildLogGroup = new CloudWatch.CloudwatchLogGroup(this, 'buildLogGroup', {
    namePrefix: `${this.options.logsPrefix}/build`,
    retentionInDays: 3,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly roleAssumeDocument = new IAM.DataAwsIamPolicyDocument(this, 'roleAssumeDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        principals: [
          {
            type: 'Service',
            identifiers: ['codebuild.amazonaws.com'],
          },
        ],
        actions: ['sts:AssumeRole'],
      },
    ],
  });

  readonly role = new IAM.IamRole(this, 'role', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    assumeRolePolicy: this.roleAssumeDocument.json,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly devNetwork = new DevNetwork(this, 'devNetwork', {
    prefix: `${this.options.prefix}-net`,
    cidrNum: this.parent.options.managerEnv.CIDR_NUM,
  });

  readonly computedOpEnv: ComputedOpEnv = {
    API_REPO_NAME: this.parent.apiDevRepo.name,
    WEB_REPO_NAME: this.parent.webDevRepo.name,
    AWS_ACCOUNT_ID: this.parent.options.sharedEnv.AWS_ACCOUNT_ID,
    S3BACKEND_REGION: this.tfstate.region,
    S3BACKEND_BUCKET: z.string().parse(this.tfstate.bucket),
    NETWORK_VPC_ID: this.devNetwork.vpc.id,
    NETWORK_DB_SG_ID: this.devNetwork.dbSg.id,
    NETWORK_LB_SG_ID: this.devNetwork.lbSg.id,
    NETWORK_SVC_SG_ID: this.devNetwork.serviceSg.id,
    NETWORK_PRIV_ID0: this.devNetwork.privateSubnets[0].id,
    NETWORK_PRIV_ID1: this.devNetwork.privateSubnets[1].id,
    NETWORK_PRIV_ID2: this.devNetwork.privateSubnets[2].id,
    NETWORK_PUB_ID0: this.devNetwork.publicSubnets[0].id,
    NETWORK_PUB_ID1: this.devNetwork.publicSubnets[1].id,
    NETWORK_PUB_ID2: this.devNetwork.publicSubnets[2].id,
  };

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_project
  // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html
  readonly build = new CodeBuild.CodebuildProject(this, 'build', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    concurrentBuildLimit: 1,
    environment: {
      // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-compute-types.html
      computeType: 'BUILD_GENERAL1_SMALL',
      type: 'LINUX_CONTAINER',
      // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
      image: 'aws/codebuild/standard:5.0',
      imagePullCredentialsType: 'CODEBUILD',
      privilegedMode: true,
      environmentVariable: [...computedOpCodeBuildEnv(this.computedOpEnv)],
    },
    source: {
      type: 'NO_SOURCE',
      buildspec: `\${file("${ensurePath(path.resolve(dataDir, 'buildspecs', 'operate-env-infra.yml'))}")}`,
    },
    // NOTE: minutes
    buildTimeout: 60,
    serviceRole: this.role.arn,
    artifacts: {
      type: 'NO_ARTIFACTS',
    },
    cache: {
      // https://docs.aws.amazon.com/codebuild/latest/userguide/build-caching.html#caching-s3
      type: 'S3',
      location: this.cachename,
      // location: this.cache.arn,
    },
    logsConfig: {
      cloudwatchLogs: {
        groupName: this.buildLogGroup.name,
      },
    },

    tagsAll: {
      ...this.options.tagsAll,
    },

    dependsOn: [this.cache],
  });

  readonly rolePolicyDocument = new IAM.DataAwsIamPolicyDocument(this, 'rolePolicyDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        resources: [`${this.buildLogGroup.arn}:*`],
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      },
      {
        // https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-actions.html
        effect: 'Allow',
        resources: [this.cache.arn, `${this.cache.arn}/*`],
        actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetObject', 's3:GetObjectAcl', 's3:DeleteObject'],
      },
      {
        // https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-actions.html
        effect: 'Allow',
        resources: [this.tfstate.arn, `${this.tfstate.arn}/*`],
        actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetObject', 's3:GetObjectAcl', 's3:DeleteObject'],
      },
    ],
  });

  // NOTE(security): dev 環境の policy で誰でも任意コード実行と考えて設計する
  readonly rolePolicy = new IAM.IamRolePolicy(this, 'rolePolicy', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    role: z.string().parse(this.role.name),
    policy: this.rolePolicyDocument.json,
  });

  readonly topic = new SNS.SnsTopic(this, 'topic', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly topicPolicyDoc = new IAM.DataAwsIamPolicyDocument(this, 'topicPolicyDoc', {
    statement: [
      {
        actions: ['sns:Publish'],
        principals: [
          {
            type: 'Service',
            identifiers: ['codestar-notifications.amazonaws.com'],
          },
        ],
        resources: [this.topic.arn],
      },
    ],
  });

  readonly topicPolicy = new SNS.SnsTopicPolicy(this, 'topicPolicy', {
    arn: this.topic.arn,
    policy: this.topicPolicyDoc.json,
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codestarnotifications_notification_rule
  readonly notification = new CodeStar.CodestarnotificationsNotificationRule(this, 'notification', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    resource: this.build.arn,
    detailType: 'BASIC',
    // https://docs.aws.amazon.com/ja_jp/dtconsole/latest/userguide/concepts.html#concepts-api
    eventTypeIds: [
      'codebuild-project-build-state-failed',
      'codebuild-project-build-state-succeeded',
      'codebuild-project-build-state-in-progress',
      'codebuild-project-build-state-stopped',
    ],
    target: [
      {
        type: 'SNS',
        address: this.topic.arn,
      },
    ],
    // TODO(logging): fail

    tagsAll: {
      ...this.options.tagsAll,
    },
  });
}
