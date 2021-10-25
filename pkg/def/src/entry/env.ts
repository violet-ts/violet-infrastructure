import { App } from 'cdktf';
import type { VioletEnvOptions } from '../stack/violet-env';
import { VioletEnvStack } from '../stack/violet-env';
import { configureBackend } from '../util/backend';
import { requireEnvEnvVars, requireSharedEnvVars } from '../app/env-vars';
import { initEnv } from '../util/init-env';

initEnv({
  produciton: false,
  development: true,
});

const sharedEnv = requireSharedEnvVars();
const envEnv = requireEnvEnvVars();

const options: VioletEnvOptions = {
  // TODO(hardcoded)
  region: 'ap-northeast-1',

  sharedEnv,
  envEnv,

  // TODO(hardcoded)
  section: 'development',
};

const app = new App();
const stack = new VioletEnvStack(app, 'violet-infra', options);
configureBackend(stack, stack.uniqueName);
app.synth();
