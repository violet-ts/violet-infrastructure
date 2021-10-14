import { App } from 'cdktf';
import type { VioletEnvOptions } from '../stack/violet-env';
import { VioletEnvStack } from '../stack/violet-env';
import { configureBackend } from '../util/backend';
import { requireSharedEnvVars } from '../util/env-vars';
import { initEnv } from '../util/init-env';

initEnv({
  produciton: false,
  development: true,
});

const sharedEnv = requireSharedEnvVars();

const options: VioletEnvOptions = {
  region: 'ap-northeast-1',

  sharedEnv,

  namespace: 'shared',
  cidrNum: '0',

  section: 'development',
};

const app = new App();
const stack = new VioletEnvStack(app, 'violet-infra', options);
configureBackend(stack, stack.uniqueName);
app.synth();
