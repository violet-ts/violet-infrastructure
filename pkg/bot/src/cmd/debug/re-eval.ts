import { z } from 'zod';
import type { CmdStatus, GeneralEntry, ReplyCmd } from '@self/bot/src/type/cmd';
import { generalEntrySchema } from '@self/bot/src/type/cmd';
import { reEvaluateAndUpdate } from '@self/bot/src/app/update-cmd';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const entrySchema = z.object({});
export type Entry = z.infer<typeof entrySchema>;

interface CommentValues {
  targetUUID: string;
  targetOldEntry: GeneralEntry | null;
  targetStatus: CmdStatus | null;
}

const cmd: ReplyCmd<Entry, CommentValues> = {
  name: 're-eval',
  where: 'any',
  description: 'Usage: uuid',
  hidden: true,
  entrySchema,
  async main(ctx, args) {
    const { env, octokit, credentials, logger } = ctx;
    const targetUUID = args[0];
    const db = new DynamoDB({ credentials, logger });
    const targetOldEntry: GeneralEntry | null = await (async () => {
      try {
        const res = await db.getItem({
          TableName: ctx.env.BOT_TABLE_NAME,
          Key: { uuid: { S: targetUUID } },
        });
        if (res.Item == null) throw new Error('no item for getItem');
        const item: unknown = unmarshall(res.Item);
        return generalEntrySchema.passthrough().parse(item);
      } catch (err: unknown) {
        logger.debug(`Checking was failed because ${err}`, { err });
        return null;
      }
    })();
    let targetStatus: CmdStatus | null = null;
    if (targetOldEntry != null) {
      ({ status: targetStatus } = await reEvaluateAndUpdate(targetOldEntry, env, octokit, credentials, logger));
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
      main: [
        `- target uuid: ${values.targetUUID}`,
        `- target found?: ${values.targetOldEntry != null ? 'yes' : 'no'}`,
        `- target status: ${values.targetStatus}`,
      ],
    };
  },
};

export default cmd;
