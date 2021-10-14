// eslint-disable-next-line max-classes-per-file
import type { Construct } from 'constructs';
import { TerraformStack, TerraformOutput } from 'cdktf';
import * as assert from 'assert';
import * as fs from 'fs';
import {
  DbSubnetGroup,
  AwsProvider,
  ResourcegroupsGroup,
  DbInstance,
  DbParameterGroup,
  Vpc,
  Route,
  InternetGateway,
  Subnet,
  SecurityGroup,
  RouteTable,
  RouteTableAssociation,
  EgressOnlyInternetGateway,
} from '@cdktf/provider-aws';
import { String as RandomString, RandomProvider, Password } from '@cdktf/provider-random';
import * as path from 'path';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource, NullProvider } from '@cdktf/provider-null';
import { PROJECT_NAME } from '../const';
import type { Section } from './violet-manager';
import type { SharedEnv } from '../util/env-vars';

export interface VioletEnvOptions {
  region: string;
  section: Section;

  sharedEnv: SharedEnv;

  /**
   * GitHub のプルリクエスト番号
   * section = "preview" の場合に限り必須
   */
  pull?: number;

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

interface MysqlDbOptions {
  violetEnvOptions: VioletEnvOptions;
  mysqlParameter: DbParameterGroup;
  /** e.g. rds:production-2015-06-26-06-05 */
  snapshotIdentifier?: string;
  vpcSecurityGroups: SecurityGroup[];
  subnets: Subnet[];
}
class MysqlDb extends Resource {
  readonly dbURL: string;

  constructor(scope: Construct, name: string, options: MysqlDbOptions, config?: ResourceConfig) {
    super(scope, name, config);
    // =================================================================
    // Password for DB
    // https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/password
    // =================================================================
    const dbPassword = new Password(this, 'dbPassword', {
      length: 32,
    });
    void dbPassword;

    // =================================================================
    // DB Subnet Group
    // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/db_subnet_group
    // =================================================================
    const dbSubnetGroup = new DbSubnetGroup(this, 'dbSubnetGroup', {
      namePrefix: `violet-${options.violetEnvOptions.namespace}-${options.violetEnvOptions.section}-`,
      subnetIds: options.subnets.map((subnet) => subnet.id),
      tags: genTags(null, options.violetEnvOptions.namespace, options.violetEnvOptions.section),
    });
    void dbSubnetGroup;

    // =================================================================
    // DbInstance
    // https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_DBInstance.html
    // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_MySQL.html#MySQL.Concepts.VersionMgmt
    // https://aws.amazon.com/rds/mysql/pricing/?pg=pr&loc=2
    // =================================================================
    // TODO(service): prod: automatic Backup for DB
    // TODO(service): prod: protection for deletion
    // TODO(service): prod: alert
    // TODO(security): prod: encryption
    // TODO(security): prod: use db subnets
    // TODO(scale): prod: DB usage should be watched
    // TODO(perf): prod: tuning at scale
    const db = new DbInstance(this, 'db', {
      // DB name
      name: `violet`,
      publiclyAccessible: ['development', 'preview', 'staging'].includes(options.violetEnvOptions.section),
      identifierPrefix: `violet-${options.violetEnvOptions.namespace}-${options.violetEnvOptions.section}-`,
      allocatedStorage: 10,
      dbSubnetGroupName: dbSubnetGroup.name,
      snapshotIdentifier: options.snapshotIdentifier,
      vpcSecurityGroupIds: options.vpcSecurityGroups.map((group) => group.id),
      copyTagsToSnapshot: true,
      engine: 'mysql',
      engineVersion: '8.0',
      instanceClass: 'db.t3.micro',
      username: 'admin',
      password: dbPassword.result,
      parameterGroupName: options.mysqlParameter.name,
      deletionProtection: false,
      // finalSnapshotIdentifier: `violet-${options.violetEnvOptions.namespace}-${options.violetEnvOptions.section}-final`,
      skipFinalSnapshot: true,
      tags: genTags(
        `Violet DB in ${options.violetEnvOptions.namespace}`,
        options.violetEnvOptions.namespace,
        options.violetEnvOptions.section,
      ),
    });
    void db;

    this.dbURL = `mysql://${db.username}:${db.password}@${db.address}:${db.port}/${db.name}`;
  }
}

export class VioletEnvStack extends TerraformStack {
  get uniqueName(): string {
    return `env-${this.options.region}-${this.options.namespace}-${this.options.section}`;
  }

  constructor(scope: Construct, name: string, private options: VioletEnvOptions) {
    super(scope, name);

    // =================================================================
    // Condition Checks
    // =================================================================
    const nsPattern = /[a-zA-Z-]+/;
    if (!options.namespace.match(nsPattern)) {
      throw new Error(`Namespace option should satisfy ${nsPattern}: got ${options.namespace}`);
    }

    if (options.section === 'preview') {
      if (options.pull == null) throw new Error('For preview section, suplly pull number.');
    }

    // =================================================================
    // Null Provider
    // =================================================================
    const nullProvider = new NullProvider(this, 'nullProvider', {});
    void nullProvider;

    // =================================================================
    // Random
    // =================================================================

    // =================================================================
    // + Random Provider
    // https://registry.terraform.io/providers/hashicorp/random/latest
    // =================================================================
    const random = new RandomProvider(this, 'random', {});
    void random;

    // =================================================================
    // + Random Suffix
    // https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/string
    // =================================================================
    const suffix = new RandomString(this, 'suffix', {
      length: 6,
      lower: true,
      upper: false,
      special: false,
    });
    void suffix;

    // =================================================================
    // + AWS Resources
    // =================================================================

    // =================================================================
    // AWS Provider
    // =================================================================
    const aws = new AwsProvider(this, 'aws', {
      region: options.region,
      profile: options.sharedEnv.AWS_PROFILE,
    });
    void aws;

    // =================================================================
    // VPC
    // https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_Vpc.html
    // https://docs.aws.amazon.com/vpc/latest/userguide/vpc-dns.html
    // =================================================================
    // const privateSubnets = [
    //   `10.${options.cidrNum}.1.0/24`,
    //   `10.${options.cidrNum}.2.0/24`,
    //   `10.${options.cidrNum}.3.0/24`,
    // ];
    const publicSubnetCidrs = [101, 102, 103];
    // const databaseSubnets = [
    //   `10.${options.cidrNum}.201.0/24`,
    //   `10.${options.cidrNum}.202.0/24`,
    //   `10.${options.cidrNum}.203.0/24`,
    // ];
    const azs = ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'];
    const vpc = new Vpc(this, 'vpc', {
      cidrBlock: `10.${options.cidrNum}.0.0/16`,
      assignGeneratedIpv6CidrBlock: true,
      // TODO(security): prod
      enableDnsSupport: true,
      // TODO(security): prod
      enableDnsHostnames: true,
      tags: genTags(`Violet ${options.namespace} ${options.section}`, options.namespace, options.section),
    });
    void vpc;

    const igw = new InternetGateway(this, 'igw', {
      vpcId: vpc.id,
      tags: genTags(null, options.namespace, options.section),
    });
    void igw;

    const igw6 = new EgressOnlyInternetGateway(this, 'igw6', {
      vpcId: vpc.id,
      tags: genTags(null, options.namespace, options.section),
    });
    void igw6;

    const apiSg = new SecurityGroup(this, 'apiSg', {
      name: `violet-api-${options.namespace}-${options.section}`,
      vpcId: vpc.id,
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
          ipv6CidrBlocks: ['::/0'],
        },
      ],
      ingress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
          ipv6CidrBlocks: ['::/0'],
        },
      ],
      tags: genTags(`Violet ${options.namespace} ${options.section}`, options.namespace, options.section),
    });
    void apiSg;

    const dbSg = new SecurityGroup(this, 'dbSg', {
      name: `violet-db-${options.namespace}-${options.section}`,
      vpcId: vpc.id,
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: [vpc.cidrBlock],
          ipv6CidrBlocks: [vpc.ipv6CidrBlock],
        },
      ],
      ingress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: [vpc.cidrBlock],
          ipv6CidrBlocks: [vpc.ipv6CidrBlock],
        },
      ],
      tags: genTags(`Violet ${options.namespace} ${options.section}`, options.namespace, options.section),
    });
    void dbSg;

    const publicRouteTable = new RouteTable(this, 'publicRouteTable', {
      vpcId: vpc.id,
      tags: genTags(null, options.namespace, options.section),
    });
    void publicRouteTable;

    const publicRouteIgw = new Route(this, `publicRouteIgw`, {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: igw.id,
    });
    void publicRouteIgw;

    const publicRouteIgw6 = new Route(this, `publicRouteIgw6`, {
      routeTableId: publicRouteTable.id,
      destinationIpv6CidrBlock: '::/0',
      egressOnlyGatewayId: igw6.id,
    });
    void publicRouteIgw6;

    const publicSubnets = publicSubnetCidrs.map(
      (num, i) =>
        new Subnet(this, `publicSubnets${i}`, {
          cidrBlock: `10.${options.cidrNum}.${num}.0/24`,
          ipv6CidrBlock: `\${cidrsubnet(${vpc.terraformResourceType}.${vpc.node.id}.ipv6_cidr_block,8,${num})}`,
          assignIpv6AddressOnCreation: true,
          availabilityZone: azs[i],
          vpcId: vpc.id,
          tags: genTags(`Violet Public ${i}`, options.namespace, options.section),
        }),
    );
    void publicSubnets;

    const publicRtbAssocs = publicSubnets.map(
      (subnet, i) =>
        new RouteTableAssociation(this, `publicRtbAssocs${i}`, {
          routeTableId: publicRouteTable.id,
          subnetId: subnet.id,
        }),
    );
    void publicRtbAssocs;

    // =================================================================
    // Resource Groups
    // -----------------------------------------------------------------
    // この namespace に属する Violet インフラを構築する、関連した
    // リソースの一覧
    // =================================================================
    const resourceGroups = new ResourcegroupsGroup(this, 'resourceGroups', {
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

    const parameter = (() => {
      const { MYSQL_PARAM_JSON } = process.env;
      assert.ok(MYSQL_PARAM_JSON, 'MYSQL_PARAM_JSON');
      const tmp: Record<string, string> = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '..', MYSQL_PARAM_JSON)).toString(),
      );
      delete tmp['//'];
      return Object.entries(tmp).map(([name, value]) => ({ name, value }));
    })();

    // =================================================================
    // DbParameterGroup
    // https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_DBParameterGroup.html
    // =================================================================
    const mysqlParameter = new DbParameterGroup(this, 'mysqlParameter', {
      name: `violet-mysql-param-${options.namespace}-${options.section}`,
      family: 'mysql8.0',
      parameter,
      tags: genTags(`Violet MySQL ${options.namespace} ${options.section}`, options.namespace, options.section),
    });
    void mysqlParameter;

    const mysql = new MysqlDb(
      this,
      'mysql',
      {
        violetEnvOptions: options,
        mysqlParameter,
        subnets: publicSubnets,
        vpcSecurityGroups: [dbSg],
      },
      {
        dependsOn: [
          // NOTE(depends): wait IGW setup
          publicRouteIgw,
          publicRouteIgw6,
        ],
      },
    );

    // =================================================================
    // Output: DB URL for prisma schema
    // =================================================================
    const dbURL = new TerraformOutput(this, 'dbURL', {
      value: mysql.dbURL,
      sensitive: true,
    });
    void dbURL;

    // =================================================================
    // ECS Cluster
    // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Cluster.html
    // =================================================================
    // const ecsCluster = new EcsCluster(this, 'main', {
    //   name: `frontend`,
    //   // TODO(security): for production
    //   // imageScanningConfiguration,
    //   tags: genTags(null, options.namespace, options.section),
    // });
    // void ecsCluster;
    //
    // =================================================================
    // ECS Task Definition
    // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_TaskDefinition.html
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definitions
    // =================================================================
    // const apiTask = new EcsTaskDefinition(this, 'apiTaskDefinition', {
    //   containerDefinitions: JSON.stringify([
    //     {
    //       name: 'frontend',
    //       image: 'repository-url/image@digest',
    //     },
    //   ]),
    //   cpu: '256',
    //   memory: '512',
    //   family: 'frontend',
    //   tags: genTags(null, options.namespace, options.section),
    // });
    // void apiTask;

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
    // S3 Bucket - service level
    // https://docs.aws.amazon.com/AmazonS3/latest/API/API_Types.html
    // =================================================================
    // const s3 = new S3Bucket(this, 's3', {
    //   // TODO(service): for prod: protection for deletion, versioning
    //   // TODO(security): for prod: encryption
    //   // TODO(logging): for prod
    //   // TODO(cost): for prod: lifecycle
    //   bucket: `violet-${options.namespace}-${options.section}-${suffix.result}`,
    //   forceDestroy: true,
    //   tags: genTags(null, options.namespace, options.section),
    // });
    // void s3;
  }
}
