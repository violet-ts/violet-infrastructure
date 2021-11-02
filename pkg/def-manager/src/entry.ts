import { App } from 'cdktf';
import { sharedEnvSchema, managerEnvSchema, extractDockerHubCred } from '@self/shared/lib/def/env-vars';
import { configureBackend } from '@self/shared/lib/def/util/backend';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import type { VioletManagerOptions } from './stack';
import { VioletManagerStack } from './stack';

initEnv();

const sharedEnv = sharedEnvSchema.parse(process.env);
const managerEnv = managerEnvSchema.parse(process.env);
const dockerHubCred = extractDockerHubCred(process.env);

const app = new App();
const options: VioletManagerOptions = {
  region: 'ap-northeast-1',
  sharedEnv,
  managerEnv,

  dockerHubCred,
};

const stack = new VioletManagerStack(app, 'violet-infra', options);
configureBackend(stack, stack.uniqueName);
app.synth();
