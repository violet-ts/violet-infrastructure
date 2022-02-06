import { vpc } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import type { VioletEnvStack } from '.';

export class DataNetwork extends Resource {
  constructor(public parent: VioletEnvStack, name: string, config?: ResourceConfig) {
    super(parent, name, config);
  }

  private readonly env = this.parent.options.computedOpEnv;

  readonly azs = ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'] as const;

  readonly vpc = new vpc.DataAwsVpc(this, 'vpc', {
    filter: [
      {
        name: 'vpc-id',
        values: [this.env.NETWORK_VPC_ID],
      },
    ],
  });

  readonly dbSg = new vpc.DataAwsSecurityGroup(this, 'dbSg', {
    vpcId: this.vpc.id,
    filter: [
      {
        name: 'group-id',
        values: [this.env.NETWORK_DB_SG_ID],
      },
    ],
  });

  readonly lbSg = new vpc.DataAwsSecurityGroup(this, 'lbSg', {
    vpcId: this.vpc.id,
    filter: [
      {
        name: 'group-id',
        values: [this.env.NETWORK_LB_SG_ID],
      },
    ],
  });

  readonly serviceSg = new vpc.DataAwsSecurityGroup(this, 'serviceSg', {
    vpcId: this.vpc.id,
    filter: [
      {
        name: 'group-id',
        values: [this.env.NETWORK_SVC_SG_ID],
      },
    ],
  });

  readonly privateSubnets = (['NETWORK_PRIV_ID0', 'NETWORK_PRIV_ID1', 'NETWORK_PRIV_ID2'] as const).map(
    (name, i) =>
      new vpc.DataAwsSubnet(this, `privateSubnets-${i}`, {
        vpcId: this.vpc.id,
        filter: [
          {
            name: 'subnet-id',
            values: [this.env[name]],
          },
        ],
      }),
  );

  readonly publicSubnets = (['NETWORK_PUB_ID0', 'NETWORK_PUB_ID1', 'NETWORK_PUB_ID2'] as const).map(
    (name, i) =>
      new vpc.DataAwsSubnet(this, `publicSubnets-${i}`, {
        vpcId: this.vpc.id,
        filter: [
          {
            name: 'subnet-id',
            values: [this.env[name]],
          },
        ],
      }),
  );
}
