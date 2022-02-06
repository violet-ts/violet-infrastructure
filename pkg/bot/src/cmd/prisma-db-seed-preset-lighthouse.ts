import prismaDbSeed from '@self/bot/src/cmd/prisma-db-seed';
import createCmd from '@self/bot/src/cmd/template/bound-cmd';
import type { ReplyCmd } from '@self/bot/src/type/cmd';

const cmdBound: ReplyCmd = prismaDbSeed as any;

const cmd = createCmd(
  {
    name: 'prisma/db/seed/preset/lighthouse',
    description: 'prisma seed preset for lighthouse',
    hidden: false,
  },
  {
    cmd: cmdBound,
    boundArgs: ['lighthouse'],
  },
);

export default cmd;
