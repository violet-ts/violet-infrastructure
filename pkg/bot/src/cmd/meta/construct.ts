import { findCmdByName } from '@self/bot/src/app/cmd';
import parallel from '@self/bot/src/cmd/meta/parallel';
import serial from '@self/bot/src/cmd/meta/serial';
import type { BoundReplyCmd } from '@self/bot/src/type/cmd';
import { marshallMetaArgs } from './util';

export const createSerial = (boundCmds: BoundReplyCmd[]): BoundReplyCmd => {
  if (boundCmds.length === 1) return boundCmds[0];
  return {
    cmd: serial as any,
    boundArgs: marshallMetaArgs(boundCmds),
  };
};

export const createParallel = (boundCmds: BoundReplyCmd[]): BoundReplyCmd => {
  if (boundCmds.length === 1) return boundCmds[0];
  return {
    cmd: parallel as any,
    boundArgs: marshallMetaArgs(boundCmds),
  };
};

export const toBoundCmd = (parsedComment: string[][][]): BoundReplyCmd => {
  if (parsedComment.length === 1 && parsedComment[0].length === 1) {
    // NOTE: for apparency
    return {
      cmd: serial as any,
      boundArgs: marshallMetaArgs([
        {
          cmd: findCmdByName(parsedComment[0][0][0]),
          boundArgs: parsedComment[0][0].slice(1),
        },
      ]),
    };
  }
  return createSerial(
    parsedComment.map(
      (args): BoundReplyCmd =>
        createParallel(
          args.map(
            (a): BoundReplyCmd => ({
              cmd: findCmdByName(a[0]),
              boundArgs: a.slice(1),
            }),
          ),
        ),
    ),
  );
};
