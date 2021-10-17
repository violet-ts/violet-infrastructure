import type { ReplyCmd } from '../type/cmd';

const name = 'ping';
type Name = typeof name;

type Entry = Record<never, never>;

interface CommentValues {
  args: string[];
}

const cmd: ReplyCmd<Name, Entry, CommentValues> = {
  cmd: name,
  where: 'any',
  description: '',
  hidden: true,
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
