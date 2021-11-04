import { DynamoDB } from '@aws-sdk/client-dynamodb';
import type { Credentials, Provider } from '@aws-sdk/types';
import { toTemporalInstant } from '@js-temporal/polyfill';
import type { Octokit } from '@octokit/rest';
import { cmds } from '@self/bot/src/app/cmds';
import { constructFullComment } from '@self/bot/src/app/webhooks';
import type { BasicContext as CommandBasicContext, CmdStatus } from '@self/bot/src/type/cmd';
import { generalEntrySchema } from '@self/bot/src/type/cmd';
import type { ComputedBotEnv } from '@self/shared/lib/bot-env';
import type { Logger } from 'winston';
import type { GeneralEntry } from '../type/cmd';

interface ReEvaluated {
  fullComment: string;
  newEntry: GeneralEntry;
  status: CmdStatus;
}
export const reEvaluateCommentEntry = async (
  oldEntry: GeneralEntry,
  env: ComputedBotEnv,
  octokit: Octokit,
  credentials: Credentials | Provider<Credentials>,
  logger: Logger,
): Promise<ReEvaluated> => {
  const cmd = cmds.find((cmd) => cmd.name === oldEntry.name);
  if (cmd == null) {
    throw new Error(`Command not found for ${oldEntry.name}`);
  }
  if (cmd.update == null) {
    throw new Error(`No need to update for command ${oldEntry.name}`);
  }
  logger.debug('Command for entry found.', { cmd });

  const cmdCtx: CommandBasicContext = {
    octokit,
    env,
    credentials,
    logger,
  };

  const { status, entry, values } = await cmd.update(cmd.entrySchema.and(generalEntrySchema).parse(oldEntry), cmdCtx);
  logger.debug('Command update processed.', { status, entry, values });
  const date = new Date();
  const newEntry = {
    ...oldEntry,
    ...entry,
    uuid: oldEntry.uuid,
    name: oldEntry.name,
    callerName: oldEntry.callerName,
    callerId: oldEntry.callerId,
    commentRepo: oldEntry.commentRepo,
    commentOwner: oldEntry.commentOwner,
    commentIssueNumber: oldEntry.commentIssueNumber,
    commentId: oldEntry.commentId,
    lastUpdate: toTemporalInstant.call(date).epochSeconds,
    botInstallationId: oldEntry.botInstallationId,
  };
  logger.debug('New entry computed.', { newEntry });
  const fullComment = constructFullComment(cmd, newEntry, values, cmdCtx);
  return {
    fullComment,
    newEntry,
    status,
  };
};

export const reEvaluateAndUpdate = async (
  oldEntry: GeneralEntry,
  env: ComputedBotEnv,
  octokit: Octokit,
  credentials: Credentials | Provider<Credentials>,
  logger: Logger,
): Promise<ReEvaluated> => {
  const reEvaluated = await reEvaluateCommentEntry(oldEntry, env, octokit, credentials, logger);
  const { fullComment, newEntry, status } = reEvaluated;
  if (status !== 'undone') {
    const db = new DynamoDB({ credentials });
    await db.deleteItem({
      TableName: env.BOT_TABLE_NAME,
      Key: {
        uuid: {
          S: newEntry.uuid,
        },
      },
    });
  }
  await octokit.issues.updateComment({
    owner: newEntry.commentOwner,
    repo: newEntry.commentRepo,
    comment_id: newEntry.commentId,
    body: fullComment,
  });
  return reEvaluated;
};
