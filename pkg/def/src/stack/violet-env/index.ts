import { AwsProvider, ResourceGroups, S3, VPC, Route53, ECS, ECR } from '@cdktf/provider-aws';
import { NullProvider } from '@cdktf/provider-null';
import { RandomProvider, String as RandomString } from '@cdktf/provider-random';
import { TerraformOutput, TerraformStack } from 'cdktf';
import type { Construct } from 'constructs';
import type { EnvEnv, SharedEnv } from '../../app/env-vars';
import { PROJECT_NAME } from '../../const';
import type { Section } from '../types';
import { ApiTask } from './api-task';
import { MysqlDb } from './mysql';
import { genTags } from './values';

export interface VioletEnvOptions {
  region: string;
  section: Section;

  sharedEnv: SharedEnv;
  envEnv: EnvEnv;
}

export class VioletEnvStack extends TerraformStack {
  get uniqueName(): string {
    return `env-${this.options.region}-${this.options.envEnv.NAMESPACE}-${this.options.section}`;
  }

  private readonly nsPattern = /[a-zA-Z-]+/;

  constructor(scope: Construct, name: string, public options: VioletEnvOptions) {
    super(scope, name);

    if (!options.envEnv.NAMESPACE.match(this.nsPattern)) {
      throw new Error(`Namespace option should satisfy ${this.nsPattern}: got ${options.envEnv.NAMESPACE}`);
    }
  }

  private readonly prefix = `violet-e-${this.options.envEnv.NAMESPACE}-${this.options.section[0]}`;

  readonly nullProvider = new NullProvider(this, 'nullProvider', {});

  readonly random = new RandomProvider(this, 'random', {});

  readonly aws = new AwsProvider(this, 'aws', {
    region: this.options.region,
    profile: this.options.sharedEnv.AWS_PROFILE,
    defaultTags: {
      tags: genTags(null, this.options.envEnv.NAMESPACE, this.options.section),
    },
  });

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  // https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_Vpc.html
  // https://docs.aws.amazon.com/vpc/latest/userguide/vpc-dns.html
  readonly privateSubnetCidrs = [1, 2, 3] as const;

  readonly publicSubnetCidrs = [101, 102, 103] as const;

  // readonly databaseSubnets = [
  //   `10.${options.cidrNum}.201.0/24`,
  //   `10.${options.cidrNum}.202.0/24`,
  //   `10.${options.cidrNum}.203.0/24`,
  // ] as const;
  readonly azs = ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'] as const;

  readonly vpc = new VPC.Vpc(this, 'vpc', {
    // TODO(hardcoded)
    cidrBlock: `10.${this.options.envEnv.CIDR_NUM}.0.0/16`,
    assignGeneratedIpv6CidrBlock: true,
    // TODO(security): prod
    enableDnsSupport: true,
    // TODO(security): prod
    enableDnsHostnames: true,
    tagsAll: {
      Name: `Violet ${this.options.envEnv.NAMESPACE} ${this.options.section}`,
    },
  });

  readonly igw = new VPC.InternetGateway(this, 'igw', {
    vpcId: this.vpc.id,
  });

  readonly apiRepo = new ECR.DataAwsEcrRepository(this, 'apiRepo', {
    name: this.options.envEnv.API_ECR_NAME,
  });

  readonly apiImage = new ECR.DataAwsEcrImage(this, 'apiImage', {
    repositoryName: this.apiRepo.name,
    // TODO(hardcoded)
    imageDigest: 'sha256:f1d2e5b9cd89b0e2a4eaccbe03210722e19b1ee6e06067c1a8803fc74d5283fa',
  });

  readonly zone = new Route53.DataAwsRoute53Zone(this, 'zone', {
    zoneId: this.options.sharedEnv.PREVIEW_ZONE_ID,
  });

  readonly dbSg = new VPC.SecurityGroup(this, 'dbSg', {
    name: `${this.prefix}-db-${this.suffix.result}`,
    vpcId: this.vpc.id,
    egress: [
      {
        fromPort: 0,
        toPort: 0,
        protocol: '-1',
        cidrBlocks: [this.vpc.cidrBlock],
        ipv6CidrBlocks: [this.vpc.ipv6CidrBlock],
      },
    ],
    ingress: [
      {
        fromPort: 0,
        toPort: 0,
        protocol: '-1',
        cidrBlocks: [this.vpc.cidrBlock],
        ipv6CidrBlocks: [this.vpc.ipv6CidrBlock],
      },
    ],
    tagsAll: {
      Name: `Violet ${this.options.envEnv.NAMESPACE} ${this.options.section}`,
    },
  });

  readonly privateRouteTable = new VPC.RouteTable(this, 'privateRouteTable', {
    vpcId: this.vpc.id,
  });

  readonly publicRouteTable = new VPC.RouteTable(this, 'publicRouteTable', {
    vpcId: this.vpc.id,
  });

  readonly publicRouteIgw = new VPC.Route(this, `publicRouteIgw`, {
    routeTableId: this.publicRouteTable.id,
    destinationCidrBlock: '0.0.0.0/0',
    gatewayId: this.igw.id,
  });

  readonly publicRouteIgw6 = new VPC.Route(this, `publicRouteIgw6`, {
    routeTableId: this.publicRouteTable.id,
    destinationIpv6CidrBlock: '::/0',
    gatewayId: this.igw.id,
  });

  readonly privateSubnets = this.privateSubnetCidrs.map(
    (num, i) =>
      new VPC.Subnet(this, `privateSubnets-${i}`, {
        // TODO(hardcoded)
        cidrBlock: `10.${this.options.envEnv.CIDR_NUM}.${num}.0/24`,
        ipv6CidrBlock: `\${cidrsubnet(${this.vpc.terraformResourceType}.${this.vpc.node.id}.ipv6_cidr_block,8,${num})}`,
        assignIpv6AddressOnCreation: true,
        availabilityZone: this.azs[i],
        vpcId: this.vpc.id,
        tagsAll: {
          Name: `Violet Private ${i}`,
        },
      }),
  );

  readonly publicSubnets = this.publicSubnetCidrs.map(
    (num, i) =>
      new VPC.Subnet(this, `publicSubnets-${i}`, {
        // TODO(hardcoded)
        cidrBlock: `10.${this.options.envEnv.CIDR_NUM}.${num}.0/24`,
        ipv6CidrBlock: `\${cidrsubnet(${this.vpc.terraformResourceType}.${this.vpc.node.id}.ipv6_cidr_block,8,${num})}`,
        assignIpv6AddressOnCreation: true,
        availabilityZone: this.azs[i],
        vpcId: this.vpc.id,
        tagsAll: {
          Name: `Violet Public ${i}`,
        },
      }),
  );

  readonly privateRtbAssocs = this.privateSubnets.map(
    (subnet, i) =>
      new VPC.RouteTableAssociation(this, `privateRtbAssocs-${i}`, {
        routeTableId: this.privateRouteTable.id,
        subnetId: subnet.id,
      }),
  );

  readonly publicRtbAssocs = this.publicSubnets.map(
    (subnet, i) =>
      new VPC.RouteTableAssociation(this, `publicRtbAssocs-${i}`, {
        routeTableId: this.publicRouteTable.id,
        subnetId: subnet.id,
      }),
  );

  // この namespace に属する Violet インフラを構築する、関連した
  // リソースの一覧
  readonly resourceGroups = new ResourceGroups.ResourcegroupsGroup(this, 'resourceGroups', {
    name: `${this.prefix}-${this.suffix.result}`,
    resourceQuery: {
      query: JSON.stringify({
        ResourceTypeFilters: ['AWS::AllSupported'],
        TagFilters: [
          {
            Key: 'Project',
            Values: [PROJECT_NAME],
          },
          {
            Key: 'Namespace',
            Values: [this.options.envEnv.NAMESPACE],
          },
        ],
      }),
    },
    tagsAll: {
      Name: `Violet Resources in ${this.options.envEnv.NAMESPACE}`,
    },
  });

  readonly mysql = new MysqlDb(
    this,
    'mysql',
    {
      prefix: `${this.prefix}-mysql`,
      subnets: this.publicSubnets,
      vpcSecurityGroups: [this.dbSg],
    },
    {
      dependsOn: [
        // NOTE(depends): wait IGW setup
        this.publicRouteIgw,
        this.publicRouteIgw6,
      ],
    },
  );

  // DB URL for prisma schema
  readonly dbURL = new TerraformOutput(this, 'dbURL', {
    value: this.mysql.dbURL,
    sensitive: true,
  });

  // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Cluster.html
  readonly cluster = new ECS.EcsCluster(this, 'cluster', {
    name: `${this.prefix}-${this.suffix.result}`,
    capacityProviders: ['FARGATE'],
    // TODO(security): for production
    // imageScanningConfiguration,
  });

  // Service level bucket
  // https://docs.aws.amazon.com/AmazonS3/latest/API/API_Types.html
  readonly s3 = new S3.S3Bucket(this, 's3', {
    // TODO(service): for prod: protection for deletion, versioning
    // TODO(security): for prod: encryption
    // TODO(logging): for prod
    // TODO(cost): for prod: lifecycle
    bucket: `${this.prefix}-${this.suffix.result}`,
    forceDestroy: true,
  });

  readonly apiTask = new ApiTask(this, 'apiTask', {
    prefix: `${this.prefix}-api`,
    ipv6interfaceIdPrefix: 10,
  });
}
