import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { reEvaluateAndUpdate } from '@self/bot/src/app/update-cmd';
import type { CmdStatus, FullEntryForTypeCheck, ReplyCmd } from '@self/bot/src/type/cmd';
import { parseFullEntryForTypeCheck } from '@self/bot/src/util/parse-entry';
import { z } from 'zod';

const entrySchema = z.object({});
export type Entry = z.infer<typeof entrySchema>;

interface CommentValues {
  targetUUID: string;
  targetOldEntry: FullEntryForTypeCheck | null;
  targetStatus: CmdStatus | null;
}

export const argSchema = {} as const;
export type ArgSchema = typeof argSchema;

const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
  name: 're-eval',
  description: 'Usage: uuid',
  hidden: true,
  entrySchema,
  argSchema,
  async main(ctx, args) {
    const { env, octokit, credentials, logger } = ctx;
    const targetUUID = args._[0] as string | undefined;
    if (!targetUUID) throw new Error('target uuid is not specified');
    const db = new DynamoDB({ credentials, logger });
    const targetOldEntry = await (async (): Promise<FullEntryForTypeCheck | null> => {
      try {
        const item = (
          await db.getItem({
            TableName: ctx.env.BOT_TABLE_NAME,
            Key: { uuid: { S: targetUUID } },
          })
        ).Item;
        if (item == null) throw new Error('no item for getItem');
        const entry: FullEntryForTypeCheck = parseFullEntryForTypeCheck(unmarshall(item));
        return entry;
      } catch (err: unknown) {
        logger.debug(`Checking was failed because ${err}`, { err });
        return null;
      }
    })();
    let targetStatus: CmdStatus | null = null;
    if (targetOldEntry != null) {
      ({ status: targetStatus } = await reEvaluateAndUpdate(targetOldEntry, env, octokit, credentials, logger, true));
    }
    return {
      status: 'success',
      entry: {},
      values: {
        targetOldEntry,
        targetUUID,
        targetStatus,
      },
    };
  },
  constructComment(_entry, values) {
    return {
      mode: 'ul',
      main: [
        `target uuid: ${values.targetUUID}`,
        `target found?: ${values.targetOldEntry != null ? 'yes' : 'no'}`,
        `target status: ${values.targetStatus}`,
      ],
    };
  },
};

export default cmd;
