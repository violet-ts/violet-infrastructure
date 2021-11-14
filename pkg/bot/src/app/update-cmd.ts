import { DynamoDB } from '@aws-sdk/client-dynamodb';
import type { Credentials, Provider } from '@aws-sdk/types';
import { Temporal } from '@js-temporal/polyfill';
import type { Octokit } from '@octokit/rest';
import { constructFullComment, findCmdByName } from '@self/bot/src/app/cmd';
import type {
  BasicContext as CommandBasicContext,
  CmdStatus,
  FullEntryForTypeCheck,
  UpdateResult,
} from '@self/bot/src/type/cmd';
import { generalEntrySchema } from '@self/bot/src/type/cmd';
import { parseFullEntryForTypeCheck } from '@self/bot/src/util/parse-entry';
import type { AccumuratedBotEnv } from '@self/shared/lib/bot/env';
import { updateTableRootKeys } from '@self/shared/lib/util/dynamodb';
import type { Logger } from 'winston';

interface ReEvaluated {
  fullComment: string;
  newEntry: FullEntryForTypeCheck;
  status: CmdStatus;
  values: UpdateResult['values'];
}
export const reEvaluateCommentEntry = async (
  oldEntry: FullEntryForTypeCheck,
  env: AccumuratedBotEnv,
  octokit: Octokit,
  credentials: Credentials | Provider<Credentials>,
  logger: Logger,
  includeHeader: boolean,
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

  const fullEntry = cmd.entrySchema.passthrough().parse(oldEntry);
  const fullEntryTyped: FullEntryForTypeCheck = parseFullEntryForTypeCheck(fullEntry);
  const result = await cmd.update(fullEntryTyped, cmdCtx);
  touchResult?.(result);
  const { status, updateEntry, values, watchTriggers, footBadges } = result;
  logger.debug('Command update processed.', { status, updateEntry, values });
  if (updateEntry != null) {
    const obj: Record<string, unknown> = updateEntry;
    Object.keys(generalEntrySchema.shape).forEach((generalKey) => {
      delete obj[generalKey];
    });
  }
  const updatedAt = Temporal.Now.instant().epochMilliseconds;
  const fullUpdateEntry = {
    ...updateEntry,
    watchTriggers: new Set([...(oldEntry.watchTriggers ?? []), ...(watchTriggers ?? [])]),
    updatedAt,
  };
  const newEntry = {
    ...fullEntryTyped,
    ...fullUpdateEntry,
  };
  await updateTableRootKeys(
    fullUpdateEntry,
    env.BOT_TABLE_NAME,
    {
      uuid: { S: oldEntry.uuid },
    },
    credentials,
    logger,
  );
  logger.debug('New entry computed.', { newEntry });
  const fullComment = constructFullComment(cmd, newEntry, values, cmdCtx, includeHeader, footBadges);
  return {
    fullComment,
    newEntry,
    status,
    values,
  };
};

export const reEvaluateAndUpdate = async (
  oldEntry: FullEntryForTypeCheck,
  env: AccumuratedBotEnv,
  octokit: Octokit,
  credentials: Credentials | Provider<Credentials>,
  logger: Logger,
  isRoot: boolean,
  touchResult?: (result: UpdateResult) => void,
): Promise<ReEvaluated> => {
  const reEvaluated = await reEvaluateCommentEntry(oldEntry, env, octokit, credentials, logger, isRoot, touchResult);
  const { fullComment, newEntry, status } = reEvaluated;
  if (status !== 'undone') {
    const db = new DynamoDB({ credentials, logger });
    await db.deleteItem({
      TableName: env.BOT_TABLE_NAME,
      Key: {
        uuid: {
          S: newEntry.uuid,
        },
      },
    });
  }
  if (isRoot) {
    await octokit.issues.updateComment({
      owner: newEntry.commentOwner,
      repo: newEntry.commentRepo,
      comment_id: newEntry.commentId,
      body: fullComment,
    });
  }
  return reEvaluated;
};
