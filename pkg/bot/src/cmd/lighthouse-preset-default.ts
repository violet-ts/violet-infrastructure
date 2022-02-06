import lighthouse from '@self/bot/src/cmd/lighthouse';
import createCmd from '@self/bot/src/cmd/template/bound-cmd';
import type { ReplyCmd } from '@self/bot/src/type/cmd';

const cmdBound: ReplyCmd = lighthouse as any;

const paths = ['', '/browser/Lighthouse%20Basic/Dir1/Work1'];

const cmd = createCmd(
  {
    name: 'lighthouse/preset/default',
    description: `test preset for ${JSON.stringify(paths)}`,
    hidden: false,
  },
  {
    cmd: cmdBound,
    boundArgs: paths,
  },
);

export default cmd;
