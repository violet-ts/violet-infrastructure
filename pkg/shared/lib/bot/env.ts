import { z } from 'zod';

export const botSecretsSchema = z.object({
  WEBHOOKS_SECRET: z.string(),
  BOT_APP_ID: z.string(),
  BOT_PRIVATE_KEY: z.string(),
});
export type BotSecrets = z.infer<typeof botSecretsSchema>;

export const computedBotEnvSchema = z.object({
  PREVIEW_DOMAIN: z.string(),
  BOT_TABLE_NAME: z.string(),
  SSM_PREFIX: z.string(),
  API_REPO_NAME: z.string(),
  WEB_REPO_NAME: z.string(),
  LAMBDA_REPO_NAME: z.string(),
  API_BUILD_PROJECT_NAME: z.string(),
  WEB_BUILD_PROJECT_NAME: z.string(),
  LAMBDA_BUILD_PROJECT_NAME: z.string(),
  OPERATE_ENV_PROJECT_NAME: z.string(),
});
export type ComputedBotEnv = z.infer<typeof computedBotEnvSchema>;
