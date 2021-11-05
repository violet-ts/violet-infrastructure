import { App } from 'cdktf';
import { configureBackend } from '@self/shared/lib/def/util/backend';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { computedOpEnvSchema, dynamicOpEnvSchema } from '@self/shared/lib/operate-env/op-env';
import { sharedEnvSchema } from '@self/shared/lib/def/env-vars';
import { computedRunScriptEnvSchema, dynamicRunScriptEnvSchema } from '@self/shared/lib/run-script/env';
import { codeBuildStackEnvSchema } from '@self/shared/lib/codebuild-stack/env';
import type { VioletEnvOptions } from './stack';
import { VioletEnvStack } from './stack';

initEnv();

const sharedEnv = sharedEnvSchema.parse(process.env);
const dynamicOpEnv = dynamicOpEnvSchema.parse(process.env);
const computedOpEnv = computedOpEnvSchema.parse(process.env);
const dynamicRunScriptEnv = dynamicRunScriptEnvSchema.parse(process.env);
const computedRunScriptEnv = computedRunScriptEnvSchema.parse(process.env);
const codeBuildStackEnv = codeBuildStackEnvSchema.parse(process.env);

const options: VioletEnvOptions = {
  // TODO(hardcoded)
  region: 'ap-northeast-1',

  sharedEnv,
  dynamicOpEnv,
  computedOpEnv,
  dynamicRunScriptEnv,
  computedRunScriptEnv,
  codeBuildStackEnv,

  // TODO(hardcoded)
  section: 'development',
};

const app = new App();
const stack = new VioletEnvStack(app, 'violet-infra', options);
configureBackend(stack, stack.uniqueName);
app.synth();
