import { DynamoDB } from '@aws-sdk/client-dynamodb';
import type { Credentials, Provider } from '@aws-sdk/types';
import { Temporal } from '@js-temporal/polyfill';
import type { Octokit } from '@octokit/rest';
import type { AccumuratedBotEnv } from '@self/shared/lib/bot/env';
import type {
  BasicContext as CommandBasicContext,
  CmdStatus,
  GeneralEntry,
  UpdateResult,
} from '@self/bot/src/type/cmd';
import { generalEntrySchema } from '@self/bot/src/type/cmd';
import type { Logger } from 'winston';
import { constructFullComment, findCmdByName } from '@self/bot/src/app/cmd';

interface ReEvaluated {
  fullComment: string;
  newEntry: GeneralEntry;
  status: CmdStatus;
  values: UpdateResult['values'];
}
export const reEvaluateCommentEntry = async (
  oldEntry: GeneralEntry,
  env: AccumuratedBotEnv,
  octokit: Octokit,
  credentials: Credentials | Provider<Credentials>,
  logger: Logger,
  touchResult?: (result: UpdateResult) => void,
): Promise<ReEvaluated> => {
  const cmd = findCmdByName(oldEntry.name);
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

  const result = await cmd.update(cmd.entrySchema.and(generalEntrySchema).parse(oldEntry), cmdCtx);
  touchResult?.(result);
  const { status, entry, values, watchArns } = result;
  logger.debug('Command update processed.', { status, entry, values });
  const updatedAt = Temporal.Now.instant().epochMilliseconds;
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
    startedAt: oldEntry.startedAt,
    watchArns: new Set([...(oldEntry.watchArns ?? []), ...(watchArns ?? [])]),
    updatedAt,
    botInstallationId: oldEntry.botInstallationId,
  };
  logger.debug('New entry computed.', { newEntry });
  const fullComment = constructFullComment(cmd, newEntry, values, cmdCtx);
  return {
    fullComment,
    newEntry,
    status,
    values,
  };
};

export const reEvaluateAndUpdate = async (
  oldEntry: GeneralEntry,
  env: AccumuratedBotEnv,
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
