import { z } from 'zod';
import buildApi from '../cmd/build-api';
import buildWeb from '../cmd/build-web';
import buildLambdaConv2img from '../cmd/build-lambda-conv2img';
import buildLambdaApiExec from '../cmd/build-lambda-apiexec';
import ping from '../cmd/ping';
import previewStart from '../cmd/preview-start';
import previewStatus from '../cmd/preview-status';
import previewRecreate from '../cmd/preview-recreate';
import previewForceDestroy from '../cmd/preview-force-destroy';
import prismaMigrateDeploy from '../cmd/prisma-migrate-deploy';
import prismaMigrateReset from '../cmd/prisma-migrate-reset';
import prismaDbSeed from '../cmd/prisma-db-seed';
import debugReEval from '../cmd/debug/re-eval';
import debugUpdatePRLabels from '../cmd/debug/update-pr-labels';
import switchCmd from '../cmd/switch';
import type { ReplyCmd } from '../type/cmd';

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
      main: cmds.filter((cmd) => values.all || !cmd.hidden).map((cmd) => `- **${cmd.name}**: ${cmd.description}`),
    };
  },
};

export const cmds: ReplyCmd[] = [
  ping,
  help,
  switchCmd,
  buildApi,
  buildWeb,
  buildLambdaConv2img,
  buildLambdaApiExec,
  previewStart,
  previewStatus,
  previewRecreate,
  previewForceDestroy,
  prismaMigrateDeploy,
  prismaMigrateReset,
  prismaDbSeed,
  debugReEval,
  debugUpdatePRLabels,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;
