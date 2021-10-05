import { App } from 'cdktf';
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { VioletManagerOptions } from '../stack/violet-manager';
import { VioletManagerStack } from '../stack/violet-manager';

dotenv.config({
  path: path.resolve(__dirname, '../.env.local'),
});

const app = new App();
const options: VioletManagerOptions = {
  region: 'ap-northeast-1',
};

void new VioletManagerStack(app, 'violet-infra', options);
app.synth();
