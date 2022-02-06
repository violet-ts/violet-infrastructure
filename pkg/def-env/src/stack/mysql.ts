import type { vpc } from '@cdktf/provider-aws';
import { rds } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { Password, StringResource as RandomString } from '@cdktf/provider-random';
import { RESOURCE_DEV_SHORT_PREFIX, RESOURCE_PROD_SHORT_PREFIX } from '@self/shared/lib/const';
import type { ComputedOpEnv } from '@self/shared/lib/operate-env/op-env';
import { Fn } from 'cdktf';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type { VioletEnvStack } from '.';
import { dataDir } from './values';

export interface MysqlDbOptions {
  tagsAll?: Record<string, string>;
  /** e.g. rds:production-2015-06-26-06-05 */
  snapshotIdentifier?: string;
  vpcSecurityGroups: vpc.DataAwsSecurityGroup[];
  subnets: vpc.DataAwsSubnet[];
  computedOpEnv: ComputedOpEnv;
}

export class MysqlDb extends Resource {
  constructor(private parent: VioletEnvStack, name: string, public options: MysqlDbOptions, config?: ResourceConfig) {
    super(parent, name, config);
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

  // https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/password
  // https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_CreateDBInstance.html
  readonly dbPassword = new Password(this, 'dbPassword', {
    length: 41,
    upper: true,
    lower: true,
    special: true,
    // https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_CreateDBInstance.html#:~:text=Required%3A%20No-,MasterUserPassword,-The%20password%20for
    // ASCII characters except '/@" '
    overrideSpecial: "$_-=\\`!#%^&*(){}[]<>.,?:;'+|~",
  });

  readonly parameter = (() => {
    const tmp: Record<string, string> = JSON.parse(
      fs.readFileSync(path.resolve(dataDir, 'mysql-params.json')).toString(),
    );
    delete tmp['//'];
    return Object.entries(tmp).map(([name, value]) => ({ name, value }));
  })();

  // https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_DBParameterGroup.html
  readonly mysqlParameter = new rds.DbParameterGroup(this, 'mysqlParameter', {
    name: `${this.shortPrefix}mysql-${this.suffix.result}`,
    family: 'mysql8.0',
    parameter: this.parameter,

    tagsAll: {
      ...this.options.tagsAll,
      Name: `Violet MySQL ${this.parent.options.dynamicOpEnv.NAMESPACE} ${this.parent.options.section}`,
    },
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/db_subnet_group
  readonly dbSubnetGroup = new rds.DbSubnetGroup(this, 'dbSubnetGroup', {
    name: `${this.shortPrefix}mysql-${this.suffix.result}`,
    subnetIds: this.options.subnets.map((subnet) => subnet.id),

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_DBInstance.html
  // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_MySQL.html#MySQL.Concepts.VersionMgmt
  // https://aws.amazon.com/rds/mysql/pricing/?pg=pr&loc=2
  // TODO(service): prod: automatic Backup for DB
  // TODO(service): prod: protection for deletion
  // TODO(service): prod: alert
  // TODO(security): prod: encryption
  // TODO(security): prod: use db subnets
  // TODO(scale): prod: DB usage should be watched
  // TODO(perf): prod: tuning at scale
  readonly db = new rds.DbInstance(this, 'db', {
    identifier: `${this.shortPrefix}mysql-${this.suffix.result}`,
    // DB name
    name: 'violet',
    publiclyAccessible: ['development', 'preview', 'staging'].includes(this.parent.options.section),
    allocatedStorage: 10,
    dbSubnetGroupName: this.dbSubnetGroup.name,
    snapshotIdentifier: this.options.snapshotIdentifier,
    vpcSecurityGroupIds: this.options.vpcSecurityGroups.map((group) => group.id),
    copyTagsToSnapshot: true,
    engine: 'mysql',
    engineVersion: '8.0',
    instanceClass: 'db.t3.micro',
    username: 'admin',
    password: this.dbPassword.result,
    parameterGroupName: this.mysqlParameter.name,
    deletionProtection: false,
    // finalSnapshotIdentifier: `violet-${options.violetEnvOptions.namespace}-${options.violetEnvOptions.section}-final`,
    skipFinalSnapshot: true,

    tagsAll: {
      ...this.options.tagsAll,
      Name: `Violet MySQL in ${this.parent.options.dynamicOpEnv.NAMESPACE}`,
    },
  });

  readonly dbURL = `mysql://${this.db.username}:${Fn.urlencode(z.string().parse(this.db.password))}@${
    this.db.address
  }:${this.db.port}/${this.db.name}`;
}
