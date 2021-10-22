import { z } from 'zod';
import build from '../cmd/build';
import ping from '../cmd/ping';
import type { ReplyCmd } from '../type/cmd';

const entrySchema = z.object({});
export type Entry = z.infer<typeof entrySchema>;

const help: ReplyCmd<Entry> = {
  name: 'help',
  where: 'any',
  description: 'help を表示する',
  hidden: false,
  entrySchema,
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
        .map((cmd) => `- **${cmd.name}**: ${cmd.description} ${cmd.where !== 'any' ? `[${cmd.where}]` : ''}`),
    };
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const cmds: ReplyCmd[] = [build, help, ping] as any;
