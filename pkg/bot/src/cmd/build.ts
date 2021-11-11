import type { ReplyCmd } from '@self/bot/src/type/cmd';
import buildApi from './build-api';
import buildWeb from './build-web';
import buildLambdaConv2img from './build-lambda-conv2img';
import buildLambdaApiExec from './build-lambda-apiexec';
import createCmd from './template/bound-cmd';
import { createParallel } from './meta/construct';

export const buildCmds: ReplyCmd[] = [
  buildApi,
  buildWeb,
  buildLambdaConv2img,
  buildLambdaApiExec,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

const cmd = createCmd(
  { name: 'build', description: 'すべてのコンテナをビルド', hidden: false },
  createParallel(buildCmds.map((cmd) => ({ cmd, boundArgs: [] }))),
);

export default cmd;
