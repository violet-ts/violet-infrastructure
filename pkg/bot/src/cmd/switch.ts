import { z } from 'zod';
import type { ReplyCmd } from '@self/bot/src/type/cmd';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { renderCode } from '../util/comment-render';

const entrySchema = z.object({});
export type Entry = z.infer<typeof entrySchema>;

interface CommentValues {
  from: string;
  to: string;
}

export const argSchema = {} as const;
export type ArgSchema = typeof argSchema;

const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
  name: 'switch',
  description: '',
  hidden: false,
  entrySchema,
  argSchema,
  async main(ctx, args) {
    const to = args._[0] as string | undefined;
    if (!to) throw new Error('変更後のネームスペース名を指定してください');
    if (!/[\w.-]+/.test(to)) throw new Error('ネームスペース名が不正です');
    const { credentials, logger } = ctx;

    const db = new DynamoDB({ credentials, logger });
    const item = (
      await db.getItem({
        TableName: ctx.env.BOT_ISSUE_MAP_TABLE_NAME,
        Key: { number: { N: ctx.commentPayload.issue.number.toString() } },
      })
    ).Item;

    if (!item) {
      await db.putItem({
        TableName: ctx.env.BOT_ISSUE_MAP_TABLE_NAME,
        Item: {
          number: {
            N: ctx.commentPayload.issue.number.toString(),
          },
        },
      });
    }

    await db.updateItem({
      TableName: ctx.env.BOT_ISSUE_MAP_TABLE_NAME,
      Key: { number: { N: ctx.commentPayload.issue.number.toString() } },
      UpdateExpression: `SET namespace = :namespace`,
      ExpressionAttributeValues: { ':namespace': { S: to } },
    });

    return {
      status: 'success',
      entry: {},
      values: {
        from: ctx.namespace,
        to,
      },
    };
  },
  constructComment(_entry, values) {
    return {
      main: [`${renderCode(values.from)} -> ${renderCode(values.to)}`],
    };
  },
};

export default cmd;
