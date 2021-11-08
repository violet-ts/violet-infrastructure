import { z } from 'zod';
import type { ReplyCmd } from '@self/bot/src/type/cmd';

const entrySchema = z.object({});
export type Entry = z.infer<typeof entrySchema>;

interface CommentValues {
  args: string[];
}

export const argSchema = {} as const;
export type ArgSchema = typeof argSchema;

const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
  name: 'ping',
  description: '',
  hidden: true,
  entrySchema,
  argSchema,
  main(ctx, _args) {
    return {
      status: 'success',
      entry: {},
      values: { args: ctx.originalArgs },
    };
  },
  constructComment(_entry, values) {
    return {
      main: [`pong ${values.args.join(' ')}`],
    };
  },
};

export default cmd;
