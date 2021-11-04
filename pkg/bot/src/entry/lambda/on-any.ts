// 各種終了時の通知
// event から対象コメントの uuid を特定し、更新をする。
// コメントは uuid さえ特定すれば他の情報を一切必要とせずに更新できるようにしている。
// そのため、uuid を特定する材料さえ見つければ良い。
import 'source-map-support/register';

import type { Handler } from 'aws-lambda';
import { toTemporalInstant } from '@js-temporal/polyfill';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { cmds } from '@self/bot/src/app/cmds';
import { createOctokit } from '@self/bot/src/app/github-app';
import { matchers } from '@self/bot/src/app/matchers';
import { constructFullComment } from '@self/bot/src/app/webhooks';
import type { BasicContext as CommandBasicContext } from '@self/bot/src/type/cmd';
import type { MatcherBasicContext } from '@self/bot/src/type/matcher';
import { computedBotEnvSchema } from '@self/shared/lib/bot-env';
import { createLambdaLogger } from '@self/bot/src/util/loggers';
import { requireSecrets } from '@self/bot/src/app/secrets';
import { generalEntrySchema } from '@self/bot/src/type/cmd';
import { getLambdaCredentials } from '../../app/aws';

const handler: Handler = async (event: unknown, context) => {
  const env = computedBotEnvSchema.parse(process.env);

  const credentials = getLambdaCredentials();
  const logger = createLambdaLogger('on-any');

  const handlerCtx: MatcherBasicContext = {
    env,
    credentials,
    logger,
  };

  const oldEntry = await (async () => {
    // eslint-disable-next-line no-restricted-syntax
    for (const handler of matchers) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const entry = await handler.handle(handlerCtx, event, context);
        return generalEntrySchema.passthrough().parse(entry);
      } catch (err: unknown) {
        logger.info(`Checking for "${handler.name}" was failed because ${err}`, { err });
      }
    }
    return null;
  })();

  if (oldEntry == null) {
    logger.warn('Unknown event.', { event, context });
    return;
  }

  const secrets = await requireSecrets(env, credentials, logger);
  const octokit = await createOctokit(env, secrets, oldEntry.botInstallationId);

  logger.info('Entry found.', { oldEntry });
  const cmd = cmds.find((cmd) => cmd.name === oldEntry.name);
  if (cmd == null) {
    logger.error(`Command not found for ${oldEntry.name}`, oldEntry);
    return;
  }
  if (cmd.update == null) {
    logger.info(`No need to update for command ${oldEntry.name}`, oldEntry);
    return;
  }
  logger.info('Command for entry found.', { cmd });

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
  const full = constructFullComment(cmd, newEntry, values, cmdCtx);

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
    body: full,
  });

  logger.info('Finishing...');
};

export { handler };
