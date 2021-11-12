// 各種終了時の通知
// event から対象コメントの uuid を特定し、更新をする。
// コメントは uuid さえ特定すれば他の情報を一切必要とせずに更新できるようにしている。
// そのため、uuid を特定する材料さえ見つければ良い。
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { matchers } from '@self/bot/src/app/matchers';
import { reEvaluateAndUpdate } from '@self/bot/src/app/update-cmd';
import type { FullEntryForTypeCheck } from '@self/bot/src/type/cmd';
import type { MatcherBasicContext } from '@self/bot/src/type/matcher';
import { parseFullEntryForTypeCheck } from '@self/bot/src/util/parse-entry';
import { getLambdaCredentials } from '@self/shared/lib/aws';
import { computedAfterwardBotEnvSchema, computedBotEnvSchema } from '@self/shared/lib/bot/env';
import { createOctokit } from '@self/shared/lib/bot/octokit';
import { requireSecrets } from '@self/shared/lib/bot/secrets';
import { sharedEnvSchema } from '@self/shared/lib/def/env-vars';
import { createLambdaLogger } from '@self/shared/lib/loggers';
import type { Handler } from 'aws-lambda';

/* eslint-disable no-restricted-syntax,no-await-in-loop */
const handler: Handler = async (event: unknown, context) => {
  const env = sharedEnvSchema.merge(computedBotEnvSchema).merge(computedAfterwardBotEnvSchema).parse(process.env);

  const credentials = getLambdaCredentials();
  const logger = createLambdaLogger('on-any');

  const handlerCtx: MatcherBasicContext = {
    env,
    credentials,
    logger,
  };

  const oldEntries = await (async (): Promise<FullEntryForTypeCheck[]> => {
    let messagesStack = [event];
    const triggersSet = new Set<string>();
    while (messagesStack.length) {
      const message = messagesStack.pop();
      logger.debug('Popped message from stack.', { poppedMessage: message, messagesStackLength: messagesStack.length });
      for (const matcher of matchers) {
        try {
          const { messages, triggers } = await matcher.match(handlerCtx, message);
          messagesStack = [...messagesStack, ...messages];
          triggers.forEach((trigger) => triggersSet.add(trigger));
          logger.debug(`Checking for "${matcher.name}" was succeeded.`, { messagesLength: messages.length, triggers });
          break;
        } catch (err: unknown) {
          logger.debug(`Checking for "${matcher.name}" was failed.`, { err });
        }
      }
    }
    logger.debug('Finished message matching.', { triggersSet });

    const triggers = [...triggersSet];

    if (triggers.length === 0) return [];

    const db = new DynamoDB({ credentials, logger });

    const expr = triggers.map((_trigger, i) => `contains(watchTriggers, :trigger${i})`).join(' OR ');
    const values = marshall(Object.fromEntries(triggers.map((trigger, i) => [`:trigger${i}`, trigger])), {
      convertEmptyValues: true,
      removeUndefinedValues: true,
    });

    const res = await db.scan({
      TableName: env.BOT_TABLE_NAME,
      // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html
      FilterExpression: expr,
      ExpressionAttributeValues: values,
    });

    const items = (res.Items ?? []).map((item) => unmarshall(item));
    const entries = items.map(parseFullEntryForTypeCheck);
    return entries;
  })();

  if (oldEntries.length === 0) {
    logger.warn('Unknown event.', { event, context });
  }

  for (const oldEntry of oldEntries) {
    logger.info('Entry found.', { oldEntry });

    const secrets = await requireSecrets(env, credentials, logger);
    const octokit = await createOctokit(secrets, oldEntry.botInstallationId);
    await reEvaluateAndUpdate(oldEntry, env, octokit, credentials, logger, true);
  }

  logger.info('Finishing...');
};
/* eslint-enable no-restricted-syntax,no-await-in-loop */

export { handler };
