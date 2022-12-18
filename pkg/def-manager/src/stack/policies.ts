import { iam } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null/lib/resource';
import { Resource } from '@cdktf/provider-null/lib/resource';
import { StringResource as RandomString } from '@cdktf/provider-random';
import { RESOURCE_DEV_IAM_PATH, RESOURCE_DEV_PREFIX } from '@self/shared/lib/const';
import type { SharedEnv } from '@self/shared/lib/def/env-vars';
import type { Construct } from 'constructs';
import { devStatements } from './policies/dev';

export interface PoliciesOptions {
  sharedEnv: SharedEnv;
}
export class Policies extends Resource {
  constructor(scope: Construct, name: string, public options: PoliciesOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 8,
    lower: true,
    upper: false,
    special: false,
  });

  readonly devPolicyDoc = new iam.DataAwsIamPolicyDocument(this, 'devPolicyDoc', {
    statement: devStatements(this.options.sharedEnv.AWS_ACCOUNT_ID),
  });

  readonly devGroup = new iam.IamGroup(this, 'devGroup', {
    name: `devgroup-${this.suffix.result}`,
    path: RESOURCE_DEV_IAM_PATH,
  });

  readonly devGroupPolicy = new iam.IamGroupPolicy(this, 'devGroupPolicy', {
    namePrefix: `${RESOURCE_DEV_PREFIX}devgroup-`,
    group: this.devGroup.name,
    policy: this.devPolicyDoc.json,
  });
}
