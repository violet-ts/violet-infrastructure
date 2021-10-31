import { z } from 'zod';
import type { CodeBuildEnv } from '../util/aws-cdk';
import { toCodeBuildEnv } from '../util/aws-cdk';

export const computedBuildEnvSchema = z.object({
  IMAGE_REPO_NAME: z.string(),
  AWS_ACCOUNT_ID: z.string(),
});

export type ComputedBuildEnv = z.infer<typeof computedBuildEnvSchema>;

export const computedBuildCodeBuildEnv = (env: ComputedBuildEnv): CodeBuildEnv => toCodeBuildEnv<ComputedBuildEnv>(env);

export const dynamicBuildEnvSchema = z.object({
  GIT_URL: z.string(),
  GIT_FETCH: z.string(),
  IMAGE_TAG: z.string(),
});

export type DynamicBuildEnv = z.infer<typeof dynamicBuildEnvSchema>;

export const dynamicBuildCodeBuildEnv = (env: DynamicBuildEnv): CodeBuildEnv => toCodeBuildEnv<DynamicBuildEnv>(env);
