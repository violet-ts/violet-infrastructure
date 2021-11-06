// GitHub の Bot の webhook 先として登録する用
import 'source-map-support/register';

import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { createWebhooks } from '@self/bot/src/app/webhooks';
import { createLambdaLogger } from '@self/shared/lib/loggers';
import { requireSecrets } from '@self/shared/lib/bot/secrets';
import { computedBotEnvSchema, computedAfterwardBotEnvSchema } from '@self/shared/lib/bot/env';
import { getLambdaCredentials } from '@self/shared/lib/aws';

const handler: APIGatewayProxyHandlerV2 = async (event, _context) => {
  const credentials = getLambdaCredentials();
  const logger = createLambdaLogger('github-bot');
  const env = computedBotEnvSchema.merge(computedAfterwardBotEnvSchema).parse(process.env);
  const secrets = await requireSecrets(env, credentials, logger);
  const { body } = event;
  if (typeof body !== 'string') throw new Error('no body found');

  const eventName = event.headers['x-github-event'];
  const signatureSHA256 = event.headers['x-hub-signature-256'];
  const id = event.headers['x-github-delivery'];
  if (typeof eventName !== 'string') throw new Error('header eventName not configured');
  if (typeof signatureSHA256 !== 'string') throw new Error('header x-hub-signature-256 not configured');
  if (typeof id !== 'string') throw new Error('header x-github-delivery not configured');

  const payload = JSON.parse(body);
  const { webhooks, onAllDone } = createWebhooks(env, secrets, credentials, logger);
  logger.info('Verifying...');
  await webhooks.verifyAndReceive({
    id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: eventName as any,
    payload,
    signature: signatureSHA256,
  });
  logger.info('Waiting all done...');
  await onAllDone();
  logger.info('Finishing...');
  return {
    statusCode: 200,
  };
};

export { handler };
