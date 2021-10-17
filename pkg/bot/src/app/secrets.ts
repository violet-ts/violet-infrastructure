import { SSM } from 'aws-sdk';
import type { Env } from './env-vars';

const keys = ['BOT_INSTALLATION_ID', 'BOT_APP_ID', 'WEBHOOKS_SECRET', 'BOT_PRIVATE_KEY'] as const;
export type SecretKeys = typeof keys[number];
export type Secrets = Record<SecretKeys, string>;

export const requireSecrets = async (env: Env): Promise<Secrets> => {
  const ssm = new SSM();
  const r = await ssm
    .getParameters({
      Names: keys.map((key) => `${env.SSM_PREFIX}/${key}`),
      WithDecryption: true,
    })
    .promise();

  const parameters = r.Parameters ?? [];

  const secrets: Secrets = Object.fromEntries(
    parameters
      .map((p) => {
        if (typeof p.Name !== 'string') throw new Error(`name not found`);
        const key = p.Name.split('/').slice(-1)[0];
        if (typeof p.Value !== 'string') throw new Error(`value for "${key}" is not found`);
        return [key, p.Value];
      })
      .filter((entry): entry is [SecretKeys, string] => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any
        return (keys as any).includes(entry[0]);
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  if (Object.keys(secrets).length !== keys.length) throw new Error('not all secrets are set');

  return secrets;
};
