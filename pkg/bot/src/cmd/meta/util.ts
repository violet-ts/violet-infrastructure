import type { BoundReplyCmd, CmdStatus } from '@self/bot/src/type/cmd';
import { findCmdByName } from '@self/bot/src/app/cmd';
import { z } from 'zod';

export const unmarshallMetaArgs = (args: string[]): BoundReplyCmd[] => {
  return args.map((a): BoundReplyCmd => {
    const [name, ...argv] = z.array(z.string()).parse(JSON.parse(a));
    const cmd = findCmdByName(name);
    return {
      cmd,
      boundArgs: argv,
    };
  });
};

export const marshallMetaArgs = (cmds: BoundReplyCmd[]): string[] => {
  return cmds.map((b): string => {
    return JSON.stringify([b.cmd.name, ...b.boundArgs]);
  });
};

export const emojiStatus = (status: CmdStatus | undefined): string => {
  switch (status) {
    case 'undone':
      return '💭';
    case 'success':
      return '✅';
    case 'failure':
      return '❌';
    default:
      return '💤';
  }
};
