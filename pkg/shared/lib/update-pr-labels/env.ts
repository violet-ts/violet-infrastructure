import { z } from 'zod';
import type { CodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import { toCodeBuildEnv } from '@self/shared/lib/util/aws-cdk';

export const dynamicUpdatePrLabelsEnvSchema = z.object({
  UPDATE_LABELS_REPO: z.string(),
  UPDATE_LABELS_OWNER: z.string(),
  UPDATE_LABELS_PR_NUMBER: z.string(),
  BOT_INSTALLATION_ID: z.string(),
});
export type DynamicUpdatePrLabelsEnv = z.infer<typeof dynamicUpdatePrLabelsEnvSchema>;
export const dynamicUpdatePrLabelsEnvCodeBuildEnv = (env: DynamicUpdatePrLabelsEnv): CodeBuildEnv =>
  toCodeBuildEnv<DynamicUpdatePrLabelsEnv>(env);
