import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import type { BotSecrets } from '@self/shared/lib/bot/env';

export const createOctokit = async (secrets: BotSecrets, installationId: number): Promise<Octokit> => {
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: secrets.BOT_APP_ID,
      privateKey: secrets.BOT_PRIVATE_KEY,
      installationId,
    },
  });
  return octokit;
};
