import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import type { Env } from './env-vars';
import type { Secrets } from './secrets';

export const createOctokit = async (_env: Env, secrets: Secrets): Promise<Octokit> => {
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: secrets.BOT_APP_ID,
      privateKey: secrets.BOT_PRIVATE_KEY,
      installationId: secrets.BOT_INSTALLATION_ID,
    },
  });
  return octokit;
};
