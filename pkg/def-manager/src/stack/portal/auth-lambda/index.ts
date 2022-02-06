import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { AuthLambdaCreate } from '@self/def-manager/src/stack/portal/auth-lambda/create';
import { AuthLambdaDefine } from '@self/def-manager/src/stack/portal/auth-lambda/define';
import { AuthLambdaVerify } from '@self/def-manager/src/stack/portal/auth-lambda/verify';
import type { SharedEnv } from '@self/shared/lib/def/env-vars';
import type { ComputedOpEnv } from '@self/shared/lib/operate-env/op-env';
import type { Construct } from 'constructs';

export interface AuthLambdaOptions {
  computedOpEnv: ComputedOpEnv;
  sharedEnv: SharedEnv;
  tagsAll?: Record<string, string>;
}
export class AuthLambda extends Resource {
  constructor(scope: Construct, name: string, public options: AuthLambdaOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  readonly createLambda = new AuthLambdaCreate(this, 'createLambda', {
    computedOpEnv: this.options.computedOpEnv,
    sharedEnv: this.options.sharedEnv,
  });

  readonly defineLambda = new AuthLambdaDefine(this, 'defineLambda', {
    computedOpEnv: this.options.computedOpEnv,
    sharedEnv: this.options.sharedEnv,
  });

  readonly verifyLambda = new AuthLambdaVerify(this, 'verifyLambda', {
    computedOpEnv: this.options.computedOpEnv,
    sharedEnv: this.options.sharedEnv,
  });
}
