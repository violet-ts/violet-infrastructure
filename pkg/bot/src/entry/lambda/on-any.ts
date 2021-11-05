// 各種終了時の通知
// event から対象コメントの uuid を特定し、更新をする。
// コメントは uuid さえ特定すれば他の情報を一切必要とせずに更新できるようにしている。
// そのため、uuid を特定する材料さえ見つければ良い。
import { getLambdaCredentials } from '@self/bot/src/app/aws';
import { createOctokit } from '@self/shared/lib/bot/octokit';
import { matchers } from '@self/bot/src/app/matchers';
import { requireSecrets } from '@self/shared/lib/bot/secrets';
import { reEvaluateAndUpdate } from '@self/bot/src/app/update-cmd';
import { generalEntrySchema } from '@self/bot/src/type/cmd';
import type { MatcherBasicContext } from '@self/bot/src/type/matcher';
import { createLambdaLogger } from '@self/bot/src/util/loggers';
import { computedBotEnvSchema } from '@self/shared/lib/bot/env';
import type { Handler } from 'aws-lambda';
import 'source-map-support/register';

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

  logger.info('Entry found.', { oldEntry });

  const secrets = await requireSecrets(env, credentials, logger);
  const octokit = await createOctokit(secrets, oldEntry.botInstallationId);
  await reEvaluateAndUpdate(oldEntry, env, octokit, credentials, logger);

  logger.info('Finishing...');
};

export { handler };
