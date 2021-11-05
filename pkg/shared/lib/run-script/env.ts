import { z } from 'zod';
import type { CodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import { toCodeBuildEnv } from '@self/shared/lib/util/aws-cdk';

export const dynamicRunScriptEnvSchema = z.object({
  ENTRY_UUID: z.string(),
});
export type DynamicRunScriptEnv = z.infer<typeof dynamicRunScriptEnvSchema>;
export const dynamicRunScriptCodeBuildEnv = (env: DynamicRunScriptEnv): CodeBuildEnv =>
  toCodeBuildEnv<DynamicRunScriptEnv>(env);

export const computedRunScriptEnvSchema = z.object({
  RUN_SCRIPT_NAME: z.string(),
  BOT_TABLE_NAME: z.string(),
});
export type ComputedRunScriptEnv = z.infer<typeof computedRunScriptEnvSchema>;
export const computedRunScriptCodeBuildEnv = (env: ComputedRunScriptEnv): CodeBuildEnv =>
  toCodeBuildEnv<ComputedRunScriptEnv>(env);
