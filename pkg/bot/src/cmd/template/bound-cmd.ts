import type { BoundReplyCmd, ReplyCmd, ReplyCmdStatic } from '@self/bot/src/type/cmd';
import arg from 'arg';

const createCmd = (st: Partial<ReplyCmdStatic>, boundCmd: BoundReplyCmd): ReplyCmd => {
  const cmd: ReplyCmd = {
    ...boundCmd.cmd,
    ...st,
    main(ctx, _args, generalEntry) {
      return boundCmd.cmd.main(
        ctx,
        arg({ '--ns': String, ...boundCmd.cmd.argSchema }, { argv: boundCmd.boundArgs }),
        generalEntry,
      );
    },
  };
  return cmd;
};

export default createCmd;
