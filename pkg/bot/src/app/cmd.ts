// 綺麗な分離単位というよりは便利な単位

import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { Temporal } from '@js-temporal/polyfill';
import arg from 'arg';
import { cmds } from '@self/bot/src/app/cmds';
import type {
  BasicContext,
  CommandContext,
  CommentBody,
  CommentValuesForTypeCheck,
  GeneralEntry,
  ReplyCmd,
  ReplyCmdMainResult,
} from '../type/cmd';
import { renderCommentBody, renderTimestamp } from '../util/comment-render';
import { embedDirective } from '../util/parse-comment';

export const findCmdByName = (name: string): ReplyCmd => {
  const cmd = cmds.find((cmd) => cmd.name === name);
  if (cmd == null) {
    throw new Error(`Command not found for ${name}`);
  }
  return cmd;
};

export const constructFullCommentBody = (
  cmd: ReplyCmd,
  entry: GeneralEntry & Parameters<ReplyCmd['constructComment']>[0],
  values: CommentValuesForTypeCheck,
  ctx: BasicContext,
): CommentBody => {
  const commentBodyStruct = cmd.constructComment(entry, values, ctx);
  const fullCommentBody = {
    ...commentBodyStruct,
    hints: [
      ...(commentBodyStruct.hints ?? []),
      {
        title: 'メタ情報',
        body: {
          main: [
            `- 開始時刻: ${renderTimestamp(Temporal.Instant.fromEpochMilliseconds(entry.startedAt))}`,
            `- 最終更新: ${renderTimestamp(Temporal.Instant.fromEpochMilliseconds(entry.updatedAt))}`,
            `- ネームスペース: \`${entry.namespace}\``,
            `- uuid: \`${entry.uuid}\``,
          ],
        },
      },
    ],
  };

  return fullCommentBody;
};

export const constructFullComment = (
  cmd: ReplyCmd,
  entry: GeneralEntry & Parameters<ReplyCmd['constructComment']>[0],
  values: CommentValuesForTypeCheck,
  ctx: BasicContext,
): string => {
  const commentHead = [embedDirective(`mark:${cmd.name}:${entry.uuid}`), `@${entry.callerName}`, '', ''].join('\n');
  const comment = renderCommentBody(constructFullCommentBody(cmd, entry, values, ctx));
  const full = commentHead + comment;
  return full;
};

export type RunMainResult = ReplyCmdMainResult & { comment: string };

export const runMain = async (
  cmd: ReplyCmd,
  ctx: CommandContext,
  argv: string[],
  generalEntry: GeneralEntry,
  createComment: boolean,
  touchResult?: (result: ReplyCmdMainResult) => void,
): Promise<RunMainResult> => {
  const { credentials, logger, env, octokit, commentPayload } = ctx;
  const parsedArgs = arg(
    {
      '--ns': String,
      ...cmd.argSchema,
    },
    { argv },
  );
  const result = await cmd.main(ctx, parsedArgs, generalEntry);
  touchResult?.(result);
  const { status, entry, values, watchArns } = result;
  logger.info('Command main process done.', { status, entry, values });

  const fullEntry = { ...entry, ...generalEntry, watchArns };
  const full = constructFullComment(cmd, fullEntry, values, ctx);

  if (createComment) {
    logger.info('Creating comment for success...');
    const createdComment = await octokit.issues.createComment({
      owner: commentPayload.repository.owner.login,
      repo: commentPayload.repository.name,
      issue_number: commentPayload.issue.number,
      body: full,
    });
    logger.info('Comment created', createdComment);
    fullEntry.commentId = createdComment.data.id;

    if (status === 'undone') {
      logger.info('Saving result...');
      const db = new DynamoDB({ credentials, logger });
      await db.putItem({
        TableName: env.BOT_TABLE_NAME,
        Item: marshall(fullEntry, { convertEmptyValues: true }),
      });
    }
  }

  return {
    entry: fullEntry,
    comment: full,
    status,
    values,
    watchArns,
  };
};
