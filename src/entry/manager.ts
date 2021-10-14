import { App } from 'cdktf';
import type { VioletManagerOptions } from '../stack/violet-manager';
import { VioletManagerStack } from '../stack/violet-manager';
import { configureBackend } from '../util/backend';
import { requireSharedEnvVars, requireDevEnvVars, requireProdEnvVars } from '../util/env-vars';
import { initEnv } from '../util/init-env';

initEnv({
  produciton: true,
  development: true,
});

const sharedEnv = requireSharedEnvVars();
const devEnv = requireDevEnvVars();
const prodEnv = requireProdEnvVars();

const app = new App();
const options: VioletManagerOptions = {
  region: 'ap-northeast-1',
  sharedEnv,
  devEnv,
  prodEnv,
};

const stack = new VioletManagerStack(app, 'violet-infra', options);
configureBackend(stack, stack.uniqueName);
app.synth();
