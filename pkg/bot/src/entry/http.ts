import { createNodeMiddleware } from '@octokit/webhooks';
import * as http from 'http';
import * as winston from 'winston';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { computedBotEnvSchema } from '@self/shared/lib/bot-env';
import { createWebhooks } from '../app/webhooks';
import { configureAws } from '../app/aws';
import { requireSecrets } from '../app/secrets';

const main = async () => {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

  const port = Number.parseInt(process.env.PORT || '8000', 10);
  const env = computedBotEnvSchema.parse(process.env);

  configureAws();

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

  const secrets = await requireSecrets(env);
  const { webhooks } = createWebhooks(env, secrets, logger);

  // eslint-disable-next-line no-console
  console.log(`Listening on :${port}`);

  http.createServer(createNodeMiddleware(webhooks, { path: '/', log: logger })).listen(port);
};

void main();
