import { vpc } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null/lib/resource';
import { Resource } from '@cdktf/provider-null/lib/resource';
import { StringResource as RandomString } from '@cdktf/provider-random';
import { Fn } from 'cdktf';
import type { Construct } from 'constructs';

export interface ApiBuildOptions {
  tagsAll?: Record<string, string>;
  cidrNum: string;
  prefix: string;
  region: string;
}

export class DevNetwork extends Resource {
  constructor(scope: Construct, name: string, public options: ApiBuildOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

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

  readonly vpc = new vpc.Vpc(this, 'vpc', {
    // TODO(hardcoded)
    cidrBlock: `10.${this.options.cidrNum}.0.0/16`,
    assignGeneratedIpv6CidrBlock: true,
    // TODO(security): prod
    enableDnsSupport: true,
    // TODO(security): prod
    enableDnsHostnames: true,
    tagsAll: {
      ...this.options.tagsAll,
      Name: 'Violet Develop Dev Network',
    },
  });

  readonly igw = new vpc.InternetGateway(this, 'igw', {
    vpcId: this.vpc.id,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly dbSg = new vpc.SecurityGroup(this, 'dbSg', {
    name: `${this.options.prefix}-db-${this.suffix.result}`,
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
      ...this.options.tagsAll,
      Name: 'Violet Develop DB',
    },
  });

  readonly lbSg = new vpc.SecurityGroup(this, 'lbSg', {
    name: `${this.options.prefix}-lb-${this.suffix.result}`,
    vpcId: this.vpc.id,
    // TODO(security): restrict
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
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly serviceSg = new vpc.SecurityGroup(this, 'serviceSg', {
    name: `${this.options.prefix}-svc-${this.suffix.result}`,
    vpcId: this.vpc.id,
    // TODO(security): restrict
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
    // ingress: [
    //   {
    //     fromPort: 80,
    //     toPort: 80,
    //     protocol: 'tcp',
    //     securityGroups: [this.lbSg.id],
    //   },
    // ],

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly privateRouteTable = new vpc.RouteTable(this, 'privateRouteTable', {
    vpcId: this.vpc.id,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly publicRouteTable = new vpc.RouteTable(this, 'publicRouteTable', {
    vpcId: this.vpc.id,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_CreateVpcEndpoint.html
  // NOTE: aws ec2 describe-vpc-endpoint-services
  readonly s3Endpoint = new vpc.VpcEndpoint(this, 's3Endpoint', {
    vpcId: this.vpc.id,
    serviceName: `com.amazonaws.${this.options.region}.s3`,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly privateRouteS3Endpoint = new vpc.VpcEndpointRouteTableAssociation(this, 'privateRouteS3Endpoint', {
    routeTableId: this.privateRouteTable.id,
    vpcEndpointId: this.s3Endpoint.id,
  });

  readonly publicRouteS3Endpoint = new vpc.VpcEndpointRouteTableAssociation(this, 'publicRouteS3Endpoint', {
    routeTableId: this.publicRouteTable.id,
    vpcEndpointId: this.s3Endpoint.id,
  });

  readonly publicRouteIgw = new vpc.Route(this, 'publicRouteIgw', {
    routeTableId: this.publicRouteTable.id,
    destinationCidrBlock: '0.0.0.0/0',
    gatewayId: this.igw.id,
  });

  readonly publicRouteIgw6 = new vpc.Route(this, 'publicRouteIgw6', {
    routeTableId: this.publicRouteTable.id,
    destinationIpv6CidrBlock: '::/0',
    gatewayId: this.igw.id,
  });

  readonly privateSubnets = this.privateSubnetCidrs.map(
    (num, i) =>
      new vpc.Subnet(this, `privateSubnets-${i}`, {
        // TODO(hardcoded)
        cidrBlock: `10.${this.options.cidrNum}.${num}.0/24`,
        ipv6CidrBlock: Fn.cidrsubnet(this.vpc.ipv6CidrBlock, 8, num),
        assignIpv6AddressOnCreation: true,
        availabilityZone: this.azs[i],
        vpcId: this.vpc.id,
        tagsAll: {
          ...this.options.tagsAll,
          Name: `Violet Develop Private ${i}`,
        },
      }),
  );

  readonly publicSubnets = this.publicSubnetCidrs.map(
    (num, i) =>
      new vpc.Subnet(this, `publicSubnets-${i}`, {
        // TODO(hardcoded)
        cidrBlock: `10.${this.options.cidrNum}.${num}.0/24`,
        ipv6CidrBlock: `\${cidrsubnet(${this.vpc.fqn}.ipv6_cidr_block,8,${num})}`,
        assignIpv6AddressOnCreation: true,
        availabilityZone: this.azs[i],
        vpcId: this.vpc.id,
        tagsAll: {
          ...this.options.tagsAll,
          Name: `Violet Develop Public ${i}`,
        },
      }),
  );

  readonly privateRtbAssocs = this.privateSubnets.map(
    (subnet, i) =>
      new vpc.RouteTableAssociation(this, `privateRtbAssocs-${i}`, {
        routeTableId: this.privateRouteTable.id,
        subnetId: subnet.id,
      }),
  );

  readonly publicRtbAssocs = this.publicSubnets.map(
    (subnet, i) =>
      new vpc.RouteTableAssociation(this, `publicRtbAssocs-${i}`, {
        routeTableId: this.publicRouteTable.id,
        subnetId: subnet.id,
      }),
  );
}
