import { z } from 'zod';
import type { CodeBuildEnv } from '../util/aws-cdk';
import { toCodeBuildEnv } from '../util/aws-cdk';

export const computedBuildEnvSchema = z.object({
  AWS_ACCOUNT_ID: z.string(),
});

export type ComputedBuildEnv = z.infer<typeof computedBuildEnvSchema>;

export const computedBuildCodeBuildEnv = (env: ComputedBuildEnv): CodeBuildEnv =>
  toCodeBuildEnv<ComputedBuildEnv>(computedBuildEnvSchema.parse(env));

export const dynamicBuildEnvSchema = z.object({
  GIT_URL: z.string(),
  GIT_FETCH: z.string(),
  IMAGE_REPO_NAME: z.string(),
  IMAGE_TAG: z.string(),
  BUILD_DOCKERFILE: z.string(),
  DOCKER_BUILD_ARGS: z.string(),
});

export type DynamicBuildEnv = z.infer<typeof dynamicBuildEnvSchema>;

export const dynamicBuildCodeBuildEnv = (env: DynamicBuildEnv): CodeBuildEnv =>
  toCodeBuildEnv<DynamicBuildEnv>(dynamicBuildEnvSchema.parse(env));
