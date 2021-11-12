import { createNodeMiddleware } from '@octokit/webhooks';
import { createWebhooks } from '@self/bot/src/app/webhooks';
import { getLambdaCredentials } from '@self/shared/lib/aws';
import { computedAfterwardBotEnvSchema, computedBotEnvSchema } from '@self/shared/lib/bot/env';
import { requireSecrets } from '@self/shared/lib/bot/secrets';
import { sharedEnvSchema } from '@self/shared/lib/def/env-vars';
import * as dotenv from 'dotenv';
import * as http from 'http';
import * as path from 'path';
import * as winston from 'winston';

const main = async () => {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

  const port = Number.parseInt(process.env.PORT || '8000', 10);
  const env = sharedEnvSchema.merge(computedBotEnvSchema).merge(computedAfterwardBotEnvSchema).parse(process.env);

  const credentials = getLambdaCredentials();

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'http' },
  });

  logger.add(
    new winston.transports.Console({
      format: winston.format.prettyPrint(),
    }),
  );

  const secrets = await requireSecrets(env, credentials, logger);
  const { webhooks } = createWebhooks(env, secrets, credentials, logger);

  // eslint-disable-next-line no-console
  console.log(`Listening on :${port}`);

  http.createServer(createNodeMiddleware(webhooks, { path: '/', log: logger })).listen(port);
};

void main();
