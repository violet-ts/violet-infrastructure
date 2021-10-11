import { App } from 'cdktf';
import type { VioletManagerOptions } from '../stack/violet-manager';
import { VioletManagerStack } from '../stack/violet-manager';
import { configureBackend } from '../util/backend';
import { initEnv } from '../util/init-env';

initEnv({
  produciton: true,
  development: true,
});

const app = new App();
const options: VioletManagerOptions = {
  region: 'ap-northeast-1',
};

const stack = new VioletManagerStack(app, 'violet-infra', options);
configureBackend(stack, stack.uniqueName);
app.synth();
