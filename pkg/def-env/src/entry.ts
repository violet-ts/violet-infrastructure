import { App } from 'cdktf';
import { configureBackend } from '@self/shared/lib/def/util/backend';
import { requireOpEnvVars, requireSharedEnvVars } from '@self/shared/lib/def/env-vars';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import type { VioletEnvOptions } from './stack';
import { VioletEnvStack } from './stack';

initEnv();

const sharedEnv = requireSharedEnvVars();
const envEnv = requireOpEnvVars();

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
