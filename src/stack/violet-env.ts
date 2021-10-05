import type { Construct } from 'constructs';
import { TerraformStack } from 'cdktf';
import {
  AwsProvider,
  Instance,
  ResourcegroupsGroup,
  EcsCluster,
  // EcsService,
  EcsTaskDefinition,
  // IamRole,
  S3Bucket,
  // S3BucketObject,
  // S3BucketPolicy,
  // SecurityGroup,
} from '@cdktf/provider-aws';
import { String as RandomString } from '@cdktf/provider-random';
import { TerraformAwsModulesVpcAws as VPC } from '../../.gen/modules/terraform-aws-modules/vpc/aws';
import { PROJECT_NAME } from '../const';
import type { Section } from './violet-manager';

export interface VioletEnvOptions {
  region: string;
  section: Section;

  /**
   * Violet Stack のリソースの管理単位。
   * 例えば、あるエンタープライズが自社クラウドリソースと組み合わせて、他とは完全に分離したAWSリソースを使いたい場合はこれを別にしたものを作成する。
   */
  namespace: string;
  /**
   * 10.?.0.0 で決め打ち。
   * NOTE: 将来必要が出たら対応。
   */
  cidrNum: string;
}

const genTags = (name: string | null, namespace: string, section: Section): Record<string, string> => {
  const tags: Record<string, string> = {
    Project: PROJECT_NAME,
    Namespace: namespace,
    Managed: 'true',
    Section: section,
  };
  if (name != null) tags.Name = name;
  return tags;
};

export class VioletEnvStack extends TerraformStack {
  constructor(scope: Construct, name: string, options: VioletEnvOptions) {
    super(scope, name);

    // =================================================================
    // 1. Condition Checks
    // =================================================================
    const nsPattern = /[a-zA-Z-]+/;
    if (!options.namespace.match(nsPattern)) {
      throw new Error(`Namespace option should satisfy ${nsPattern}: got ${options.namespace}`);
    }

    // =================================================================
    // 2. Random Suffix
    // =================================================================
    const suffix = new RandomString(this, 'suffix', {
      length: 6,
    });

    // =================================================================
    // 3. AWS Resources
    // =================================================================

    // =================================================================
    // AWS Provider
    // =================================================================
    const awsProvider = new AwsProvider(this, 'aws', {
      region: options.region,
      profile: process.env.AWS_PROFILE,
      accessKey: process.env.AWS_ACCESS_KEY,
      secretKey: process.env.AWS_SECRET_KEY,
    });
    void awsProvider;

    // =================================================================
    // VPC
    // =================================================================
    const vpc = new VPC(this, 'vpc', {
      name,
      azs: ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'],
      cidr: `10.${options.cidrNum}.0.0/16`,
      privateSubnets: [`10.${options.cidrNum}.1.0/24`, `10.${options.cidrNum}.2.0/24`, `10.${options.cidrNum}.3.0/24`],
      publicSubnets: [
        `10.${options.cidrNum}.101.0/24`,
        `10.${options.cidrNum}.102.0/24`,
        `10.${options.cidrNum}.103.0/24`,
      ],
      databaseSubnets: [
        `10.${options.cidrNum}.201.0/24`,
        `10.${options.cidrNum}.202.0/24`,
        `10.${options.cidrNum}.203.0/24`,
      ],
      tags: genTags(null, options.namespace, options.section),
      publicSubnetTags: {
        Name: 'Public Subnet',
      },
      privateSubnetTags: {
        Name: 'Private Subnet',
      },
      databaseSubnetTags: {
        Name: 'Database Subnet',
      },
    });
    void vpc;

    // =================================================================
    // Resource Groups
    // -----------------------------------------------------------------
    // この namespace に属する Violet インフラを構築する、関連した
    // リソースの一覧
    // =================================================================
    const resourceGroups = new ResourcegroupsGroup(this, 'resources-namespaced', {
      name: `violet-env-${options.namespace}`,
      resourceQuery: [
        {
          query: JSON.stringify({
            ResourceTypeFilters: ['AWS::AllSupported'],
            TagFilters: [
              {
                Key: 'Project',
                Values: [PROJECT_NAME],
              },
              {
                Key: 'Namespace',
                Values: [options.namespace],
              },
            ],
          }),
        },
      ],
      tags: genTags(`Violet Resources in ${options.namespace}`, options.namespace, options.section),
    });
    void resourceGroups;

    // =================================================================
    // ECS Cluster
    // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Cluster.html
    // =================================================================
    const ecsCluster = new EcsCluster(this, 'main', {
      name: `frontend`,
      // TODO(security): for production
      // imageScanningConfiguration,
      tags: genTags(null, options.namespace, options.section),
    });
    void ecsCluster;

    // =================================================================
    // ECS Task Definition
    // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_TaskDefinition.html
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definitions
    // =================================================================
    const ecsTaskDefinition = new EcsTaskDefinition(this, 'frontend', {
      containerDefinitions: JSON.stringify([
        {
          name: 'frontend',
          image: 'repository-url/image@digest',
        },
      ]),
      cpu: '256',
      memory: '512',
      family: 'frontend',
      tags: genTags(null, options.namespace, options.section),
    });
    void ecsTaskDefinition;

    // =================================================================
    // ECS Service
    // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Service.html
    // =================================================================
    // const ecsService = new EcsService(this, '', {
    //   name: '',
    //   cluster: ecsCluster.id,
    //   tags: genTags(null, options.namespace, options.section),
    // });
    // void ecsService;

    // =================================================================
    // Instance for DB
    // -----------------------------------------------------------------
    // TODO(scale): managed も見据える。 4GB を危険域とする
    // =================================================================
    const db = new Instance(this, '', {
      tags: genTags(null, options.namespace, options.section),
    });
    void db;

    // =================================================================
    // S3 Bucket - service level
    // https://docs.aws.amazon.com/AmazonS3/latest/API/API_Types.html
    // =================================================================
    const s3 = new S3Bucket(this, '', {
      // TODO(service): for prod: protection for deletion, versioning
      // TODO(security): for prod: encryption
      // TODO(logging): for prod
      // TODO(cost): for prod: lifecycle
      bucket: `violet-${options.namespace}-${options.section}-${suffix}`,
      forceDestroy: true,
      tags: genTags(null, options.namespace, options.section),
    });
    void s3;
  }
}
