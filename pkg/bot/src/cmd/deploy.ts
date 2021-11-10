import type { ReplyCmd } from '@self/bot/src/type/cmd';
import prismaMigrateDeploy from '@self/bot/src/cmd/prisma-migrate-deploy';
import build from './build';
import previewStart from './preview-start';
import createCmd from './template/bound-cmd';
import { createSerial } from './meta/construct';

const cmds: ReplyCmd[] = [
  build,
  previewStart,
  prismaMigrateDeploy,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

const cmd = createCmd(
  { name: 'deploy', description: 'build → preview start → prisma migrate deploy', hidden: false },
  createSerial(cmds.map((cmd) => ({ cmd, boundArgs: [] }))),
);

export default cmd;
