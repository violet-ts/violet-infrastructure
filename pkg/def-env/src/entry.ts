import { App } from 'cdktf';
import { configureBackend } from '@self/shared/lib/def/util/backend';
import { requireSharedEnvVars } from '@self/shared/lib/def/env-vars';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { computedOpEnvSchema, dynamicOpEnvSchema } from '@self/shared/lib/operate-env/op-env';
import type { VioletEnvOptions } from './stack';
import { VioletEnvStack } from './stack';

initEnv();

const sharedEnv = requireSharedEnvVars();
const dynamicOpEnv = dynamicOpEnvSchema.parse(process.env);
const computedOpEnv = computedOpEnvSchema.parse(process.env);

const options: VioletEnvOptions = {
  // TODO(hardcoded)
  region: 'ap-northeast-1',

  sharedEnv,
  dynamicOpEnv,
  computedOpEnv,

  // TODO(hardcoded)
  section: 'development',
};

const app = new App();
const stack = new VioletEnvStack(app, 'violet-infra', options);
configureBackend(stack, stack.uniqueName);
app.synth();
