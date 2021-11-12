import prismaMigrateDeploy from '@self/bot/src/cmd/prisma-migrate-deploy';
import type { ReplyCmd } from '@self/bot/src/type/cmd';
import build from './build';
import { createSerial } from './meta/construct';
import previewStart from './preview-start';
import createCmd from './template/bound-cmd';

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
