import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import type { BotSecrets, ComputedBotEnv } from '@self/shared/lib/bot-env';

export const createOctokit = async (_env: ComputedBotEnv, secrets: BotSecrets): Promise<Octokit> => {
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
