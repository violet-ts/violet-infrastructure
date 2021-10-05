import { App } from 'cdktf';
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { VioletEnvOptions } from '../stack/violet-env';
import { VioletEnvStack } from '../stack/violet-env';

dotenv.config({
  path: path.resolve(__dirname, '../.env.local'),
});

const app = new App();
const options: VioletEnvOptions = {
  region: 'ap-northeast-1',

  namespace: 'shared',
  cidrNum: '0',

  section: 'development',
};

void new VioletEnvStack(app, 'violet-infra', options);
app.synth();
