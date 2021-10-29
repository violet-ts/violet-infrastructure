import { App } from 'cdktf';
import { requireSharedEnvVars, requireManagerEnvVars } from '@self/shared/lib/def/env-vars';
import { configureBackend } from '@self/shared/lib/def/util/backend';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import type { VioletManagerOptions } from './stack';
import { VioletManagerStack } from './stack';

initEnv();

const sharedEnv = requireSharedEnvVars();
const managerEnv = requireManagerEnvVars();

const app = new App();
const options: VioletManagerOptions = {
  region: 'ap-northeast-1',
  sharedEnv,
  managerEnv,
};

const stack = new VioletManagerStack(app, 'violet-infra', options);
configureBackend(stack, stack.uniqueName);
app.synth();
