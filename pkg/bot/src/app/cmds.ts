import build from '../cmd/build';
import ping from '../cmd/ping';
import type { ReplyCmd } from '../type/cmd';

const help: ReplyCmd = {
  cmd: 'help',
  where: 'any',
  description: 'help を表示する',
  hidden: false,
  main(_ctx, _args) {
    return {
      save: false,
      entry: {},
      values: undefined,
    };
  },
  constructComment() {
    return {
      main: cmds
        .filter((cmd) => !cmd.hidden)
        .map((cmd) => `- **${cmd.cmd}**: ${cmd.description} ${cmd.where !== 'any' ? `[${cmd.where}]` : ''}`),
    };
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const cmds: ReplyCmd[] = [build, help, ping] as any;
