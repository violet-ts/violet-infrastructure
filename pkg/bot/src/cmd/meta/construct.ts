import type { BoundReplyCmd } from '@self/bot/src/type/cmd';
import { findCmdByName } from '@self/bot/src/app/cmd';
import parallel from '@self/bot/src/cmd/meta/parallel';
import serial from '@self/bot/src/cmd/meta/serial';
import { marshallMetaArgs } from './util';

export const createSerial = (boundCmds: BoundReplyCmd[]): BoundReplyCmd => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cmd: serial as any,
    boundArgs: marshallMetaArgs(boundCmds),
  };
};

export const createParallel = (boundCmds: BoundReplyCmd[]): BoundReplyCmd => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cmd: parallel as any,
    boundArgs: marshallMetaArgs(boundCmds),
  };
};

export const toBoundCmd = (parsedComment: string[][][]): BoundReplyCmd => {
  if (parsedComment.length === 1) {
    return createSerial(
      parsedComment[0].map(
        (a): BoundReplyCmd => ({
          cmd: findCmdByName(a[0]),
          boundArgs: a.slice(1),
        }),
      ),
    );
  }
  return createParallel(
    parsedComment.map(
      (args): BoundReplyCmd =>
        createSerial(
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
