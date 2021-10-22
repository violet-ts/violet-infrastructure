import { z } from 'zod';
import type { ReplyCmd } from '../type/cmd';

const entrySchema = z.object({});
export type Entry = z.infer<typeof entrySchema>;

interface CommentValues {
  args: string[];
}

const cmd: ReplyCmd<Entry, CommentValues> = {
  name: 'ping',
  where: 'any',
  description: '',
  hidden: true,
  entrySchema,
  main(_ctx, args) {
    return {
      save: false,
      entry: {},
      values: { args },
    };
  },
  constructComment(_entry, values) {
    return {
      main: [`pong ${values.args.join(' ')}`],
    };
  },
};

export default cmd;
