import { z } from 'zod';
import type { CodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import { toCodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import { sharedEnvSchema } from '@self/shared/lib/def/env-vars';

export const botSecretsSchema = z.object({
  WEBHOOKS_SECRET: z.string(),
  BOT_APP_ID: z.string(),
  TF_ENV_BACKEND_TOKEN: z.string(),
  BOT_PRIVATE_KEY: z.string(),
});
export type BotSecrets = z.infer<typeof botSecretsSchema>;

export const computedBotEnvSchema = z.object({
  PREVIEW_DOMAIN: z.string(),
  INFRA_SOURCE_BUCKET: z.string(),
  INFRA_SOURCE_ZIP_KEY: z.string(),
  BOT_SSM_PREFIX: z.string(),
  BOT_TABLE_NAME: z.string(),
  BOT_ISSUE_MAP_TABLE_NAME: z.string(),
  BOT_TOPIC_NAME: z.string(),
});
export type ComputedBotEnv = z.infer<typeof computedBotEnvSchema>;
export const computedBotCodeBuildEnv = (env: ComputedBotEnv): CodeBuildEnv =>
  toCodeBuildEnv<ComputedBotEnv>(computedBotEnvSchema.parse(env));

export const computedAfterwardBotEnvSchema = z.object({
  API_REPO_NAME: z.string(),
  WEB_REPO_NAME: z.string(),
  LAMBDA_CONV2IMG_REPO_NAME: z.string(),
  LAMBDA_APIEXEC_REPO_NAME: z.string(),
  API_BUILD_PROJECT_NAME: z.string(),
  WEB_BUILD_PROJECT_NAME: z.string(),
  LAMBDA_CONV2IMG_BUILD_PROJECT_NAME: z.string(),
  LAMBDA_APIEXEC_BUILD_PROJECT_NAME: z.string(),
  OPERATE_ENV_PROJECT_NAME: z.string(),
  PR_UPDATE_LABELS_PROJECT_NAME: z.string(),
});
export type ComputedAfterwardBotEnv = z.infer<typeof computedAfterwardBotEnvSchema>;

export const accumuratedBotEnvSchema = sharedEnvSchema.merge(computedBotEnvSchema).merge(computedAfterwardBotEnvSchema);
export type AccumuratedBotEnv = z.infer<typeof accumuratedBotEnvSchema>;
