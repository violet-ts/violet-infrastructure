import { z } from 'zod';
import type { ReplyCmd } from '@self/bot/src/type/cmd';
import build, { buildCmds } from '@self/bot/src/cmd/build';
import ping from '@self/bot/src/cmd/ping';
import previewStart from '@self/bot/src/cmd/preview-start';
import previewStatus from '@self/bot/src/cmd/preview-status';
import previewRecreate from '@self/bot/src/cmd/preview-recreate';
import previewForceDestroy from '@self/bot/src/cmd/preview-force-destroy';
import prismaMigrateDeploy from '@self/bot/src/cmd/prisma-migrate-deploy';
import prismaMigrateReset from '@self/bot/src/cmd/prisma-migrate-reset';
import prismaDbSeed from '@self/bot/src/cmd/prisma-db-seed';
import debugReEval from '@self/bot/src/cmd/debug/re-eval';
import debugUpdatePRLabels from '@self/bot/src/cmd/debug/update-pr-labels';
import switchCmd from '@self/bot/src/cmd/switch';
import parallel from '@self/bot/src/cmd/meta/parallel';
import serial from '@self/bot/src/cmd/meta/serial';

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
      // TODO(hardcoded): cmd prefix
      main: cmds.filter((cmd) => values.all || !cmd.hidden).map((cmd) => `- **/${cmd.name}**: ${cmd.description}`),
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
  debugReEval,
  debugUpdatePRLabels,
  parallel,
  serial,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;
