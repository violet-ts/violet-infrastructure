import type { DynamoDB, ECR } from '@cdktf/provider-aws';
import { IAM, S3 } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import type { ManagerEnv, SharedEnv } from '@self/shared/lib/def/env-vars';
import type { ComputedOpEnv } from '@self/shared/lib/operate-env/op-env';
import { computedOpCodeBuildEnv } from '@self/shared/lib/operate-env/op-env';
import type { Construct } from 'constructs';
import { z } from 'zod';
import type { BuildDictContext } from './bot';
import { DevNetwork } from './dev-network';
import { RunScript } from './run-script';

export interface OperateEnvOptions {
  tagsAll: Record<string, string>;
  prefix: string;
  logsPrefix: string;
  botSsmPrefix: string;
  botTable: DynamoDB.DynamodbTable;
  sharedEnv: SharedEnv;
  managerEnv: ManagerEnv;
  apiDevRepo: ECR.EcrRepository;
  webDevRepo: ECR.EcrRepository;
  infraSourceBucket: S3.S3Bucket;
  infraSourceZip: S3.S3BucketObject;

  buildDictContext: BuildDictContext;
}

/**
 * 一つの環境を terraform で deploy/destroy するための CodeBuild Project とその関連
 */
export class OperateEnv extends Resource {
  constructor(scope: Construct, name: string, public options: OperateEnvOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  readonly tfstate = new S3.S3Bucket(this, 'tfstate', {
    bucket: `${this.options.prefix}-tfstate-${this.suffix.result}`,
    acl: 'private',
    forceDestroy: true,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly devNetwork = new DevNetwork(this, 'devNetwork', {
    prefix: `${this.options.prefix}-net`,
    cidrNum: this.options.managerEnv.CIDR_NUM,
  });

  readonly computedOpEnv: ComputedOpEnv = {
    API_REPO_NAME: this.options.apiDevRepo.name,
    WEB_REPO_NAME: this.options.webDevRepo.name,
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

  readonly runScript = new RunScript(this, 'runScript', {
    name: 'Ope',
    sharedEnv: this.options.sharedEnv,
    managerEnv: this.options.managerEnv,
    prefix: `${this.options.prefix}-rs`,
    logsPrefix: this.options.logsPrefix,
    runScriptName: 'operate-env.ts',
    botSsmPrefix: this.options.botSsmPrefix,
    botTable: this.options.botTable,
    environmentVariable: [...computedOpCodeBuildEnv(this.computedOpEnv)],
    buildDictContext: this.options.buildDictContext,
    infraSourceBucket: this.options.infraSourceBucket,
    infraSourceZip: this.options.infraSourceZip,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly rolePolicyDocument = new IAM.DataAwsIamPolicyDocument(this, 'rolePolicyDocument', {
    version: '2012-10-17',
    statement: [
      {
        // TODO(security): 強すぎる。 https://github.com/violet-ts/violet-infrastructure/issues/20
        effect: 'Allow',
        resources: ['*'],
        actions: [
          'cloudwatch:*',
          'logs:*',
          'ec2:*',
          'ecr:*',
          'rds:*',
          'application-autoscaling:*',
          'resource-groups:*',

          'ecs:*',
          'events:*',
          'servicediscovery:*',
          'elasticloadbalancing:*',
          'elasticfilesystem:*',
          'appmesh:*',
          'autoscaling:*',
          'cloudformation:*',
          'codedeploy:*',

          'iam:*',
          'lambda:*',
          'resourcegroups:*',
          'route53:*',
          's3:*',
          'secretsmanager:*',
          'sns:*',
          'ssm:*',

          // ACM readonly
          'acm:DescribeCertificate',
          'acm:ListCertificates',
          'acm:GetCertificate',
          'acm:ListTagsForCertificate',
          'acm:GetAccountConfiguration',
        ],
      },

      // CodeBuild Readonly
      {
        actions: [
          'codebuild:BatchGet*',
          'codebuild:GetResourcePolicy',
          'codebuild:List*',
          'codebuild:DescribeTestCases',
          'codebuild:DescribeCodeCoverages',
          'codecommit:GetBranch',
          'codecommit:GetCommit',
          'codecommit:GetRepository',
          'cloudwatch:GetMetricStatistics',
          'events:DescribeRule',
          'events:ListTargetsByRule',
          'events:ListRuleNamesByTarget',
          'logs:GetLogEvents',
        ],
        effect: 'Allow',
        resources: ['*'],
      },
      {
        effect: 'Allow',
        actions: ['codestar-connections:ListConnections', 'codestar-connections:GetConnection'],
        resources: ['arn:aws:codestar-connections:*:*:connection/*'],
      },
      {
        effect: 'Allow',
        actions: ['codestar-notifications:DescribeNotificationRule'],
        resources: ['*'],
        condition: [
          {
            test: 'StringLike',
            variable: 'codestar-notifications:NotificationsForResource',
            values: ['arn:aws:codebuild:*'],
          },
        ],
      },
      {
        effect: 'Allow',
        actions: [
          'codestar-notifications:ListNotificationRules',
          'codestar-notifications:ListEventTypes',
          'codestar-notifications:ListTargets',
        ],
        resources: ['*'],
      },

      // ここからは、個別に指定した必須の権限

      {
        effect: 'Allow',
        actions: [`dynamodb:UpdateItem`],
        resources: [this.options.botTable.arn],
      },
      {
        // https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-actions.html
        effect: 'Allow',
        resources: [this.tfstate.arn, `${this.tfstate.arn}/*`],
        actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetObject', 's3:GetObjectAcl', 's3:DeleteObject'],
      },
    ],
  });

  readonly rolePolicy = new IAM.IamRolePolicy(this, 'rolePolicy', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    role: z.string().parse(this.runScript.buildStack.role.name),
    policy: this.rolePolicyDocument.json,
  });
}
