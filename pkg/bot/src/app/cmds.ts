import build, { buildCmds } from '@self/bot/src/cmd/build';
import debugReEval from '@self/bot/src/cmd/debug/re-eval';
import debugUpdatePRLabels from '@self/bot/src/cmd/debug/update-pr-labels';
import deploy from '@self/bot/src/cmd/deploy';
import parallel from '@self/bot/src/cmd/meta/parallel';
import serial from '@self/bot/src/cmd/meta/serial';
import ping from '@self/bot/src/cmd/ping';
import previewForceDestroy from '@self/bot/src/cmd/preview-force-destroy';
import previewRecreate from '@self/bot/src/cmd/preview-recreate';
import previewStart from '@self/bot/src/cmd/preview-start';
import previewStatus from '@self/bot/src/cmd/preview-status';
import prismaDbSeed from '@self/bot/src/cmd/prisma-db-seed';
import prismaMigrateDeploy from '@self/bot/src/cmd/prisma-migrate-deploy';
import prismaMigrateReset from '@self/bot/src/cmd/prisma-migrate-reset';
import switchCmd from '@self/bot/src/cmd/switch';
import type { ReplyCmd } from '@self/bot/src/type/cmd';
import { renderAnchor, renderCode } from '@self/bot/src/util/comment-render';
import { z } from 'zod';

const entrySchema = z.object({});
export type Entry = z.infer<typeof entrySchema>;
export type CommentValues = { all: boolean };
export const argSchema = {
  '--all': Boolean,
} as const;
export type ArgSchema = typeof argSchema;

const help: ReplyCmd<Entry, CommentValues, ArgSchema> = {
  name: 'help',
  description: '[--all: すべて表示]',
  hidden: false,
  entrySchema,
  argSchema,
  main(_ctx, args) {
    return {
      status: 'success',
      entry: {},
      values: { all: Boolean(args['--all']) },
    };
  },
  constructComment(_entry, values) {
    return {
      mode: 'ul',
      // TODO(hardcoded): cmd prefix
      main: [
        ...cmds
          .filter((cmd) => values.all || !cmd.hidden)
          .map((cmd) => `${renderCode(`/${cmd.name}`)} ${cmd.description}`),
        renderAnchor(
          'wiki/Botの使い方',
          'https://github.com/violet-ts/violet/wiki/Bot-%E3%81%AE%E4%BD%BF%E3%81%84%E6%96%B9',
        ),
      ],
    };
  },
};

export const cmds: ReplyCmd[] = [
  ping,
  help,
  switchCmd,
  build,
  ...buildCmds,
  previewStart,
  previewStatus,
  previewRecreate,
  previewForceDestroy,
  prismaMigrateDeploy,
  prismaMigrateReset,
  prismaDbSeed,
  deploy,
  debugReEval,
  debugUpdatePRLabels,
  parallel,
  serial,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;
