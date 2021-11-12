import type { ReplyCmd } from '@self/bot/src/type/cmd';
import buildApi from './build-api';
import buildLambdaApiExec from './build-lambda-apiexec';
import buildLambdaConv2img from './build-lambda-conv2img';
import buildWeb from './build-web';
import { createParallel } from './meta/construct';
import createCmd from './template/bound-cmd';

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
