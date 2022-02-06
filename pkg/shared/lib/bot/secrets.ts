import { SSM } from '@aws-sdk/client-ssm';
import type { Credentials, Provider } from '@aws-sdk/types';
import type { BotSecrets, ComputedBotEnv } from '@self/shared/lib/bot/env';
import { botSecretsSchema } from '@self/shared/lib/bot/env';
import type { Logger } from 'winston';

const keys = Object.keys(botSecretsSchema.shape);
type SecretKeys = keyof BotSecrets;

export const requireSecrets = async (
  env: ComputedBotEnv,
  credentials: Credentials | Provider<Credentials>,
  logger: Logger,
): Promise<BotSecrets> => {
  const ssm = new SSM({ credentials, logger });
  const r = await ssm.getParameters({
    Names: keys.map((key) => `${env.BOT_SSM_PREFIX}/${key}`),
    WithDecryption: true,
  });

  const parameters = r.Parameters ?? [];

  const secrets: BotSecrets = Object.fromEntries(
    parameters
      .map((p) => {
        if (typeof p.Name !== 'string') throw new Error('name not found');
        const key = p.Name.split('/').slice(-1)[0];
        if (typeof p.Value !== 'string') throw new Error(`value for "${key}" is not found`);
        return [key, p.Value];
      })
      .filter((entry): entry is [SecretKeys, string] => {
        return keys.includes(entry[0]);
      }),
  ) as any;

  if (Object.keys(secrets).length !== keys.length) throw new Error('not all secrets are set');

  return secrets;
};
