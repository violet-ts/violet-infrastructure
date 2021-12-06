import build from '@self/bot/src/cmd/build';
import lighthousePresetDefault from '@self/bot/src/cmd/lighthouse-preset-default';
import { createSerial } from '@self/bot/src/cmd/meta/construct';
import previewStart from '@self/bot/src/cmd/preview-start';
import prismaDbSeedPresetLighthouse from '@self/bot/src/cmd/prisma-db-seed-preset-lighthouse';
import prismaMigrateDeploy from '@self/bot/src/cmd/prisma-migrate-deploy';
import createCmd from '@self/bot/src/cmd/template/bound-cmd';
import type { ReplyCmd } from '@self/bot/src/type/cmd';

const cmds: ReplyCmd[] = [
  build,
  previewStart,
  prismaMigrateDeploy,
  prismaDbSeedPresetLighthouse,
  lighthousePresetDefault,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

const cmd = createCmd(
  {
    name: 'deploy',
    description: 'build → preview start → prisma migrate deploy → lighthouse seeding → lighthouse test',
    hidden: false,
  },
  createSerial(cmds.map((cmd) => ({ cmd, boundArgs: [] }))),
);

export default cmd;
