import { z } from 'zod';
import type { CodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import { toCodeBuildEnv } from '@self/shared/lib/util/aws-cdk';

export const codeBuildStackEnvSchema = z.object({
  SCRIPT_ROLE_NAME: z.string(),
});
export type CodeBuildStackEnv = z.infer<typeof codeBuildStackEnvSchema>;
export const codeBuildStackCodeBuildEnv = (env: CodeBuildStackEnv): CodeBuildEnv =>
  toCodeBuildEnv<CodeBuildStackEnv>(codeBuildStackEnvSchema.parse(env));
