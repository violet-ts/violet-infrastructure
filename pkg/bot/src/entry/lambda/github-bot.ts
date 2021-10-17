// GitHub の Bot の webhook 先として登録する用

import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { createWebhooks } from '../../app/webhooks';
import { requireEnvVars } from '../../app/env-vars';
import { createLambdaLogger } from '../../util/loggers';
import { requireSecrets } from '../../app/secrets';

const handler: APIGatewayProxyHandlerV2 = async (event, _context) => {
  const logger = createLambdaLogger();
  const env = requireEnvVars();
  const secrets = await requireSecrets(env);
  const { body } = event;
  if (typeof body !== 'string') throw new Error('no body found');

  const eventName = event.headers['x-github-event'];
  const signatureSHA256 = event.headers['x-hub-signature-256'];
  const id = event.headers['x-github-delivery'];
  if (typeof eventName !== 'string') throw new Error('header eventName not configured');
  if (typeof signatureSHA256 !== 'string') throw new Error('header x-hub-signature-256 not configured');
  if (typeof id !== 'string') throw new Error('header x-github-delivery not configured');

  const payload = JSON.parse(body);
  const { webhooks, onAllDone } = createWebhooks(env, secrets, logger);
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
