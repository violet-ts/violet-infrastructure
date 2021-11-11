import type { CodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import { toCodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import { z } from 'zod';

export const codeBuildStackEnvSchema = z.object({
  SCRIPT_ROLE_NAME: z.string(),
});
export type CodeBuildStackEnv = z.infer<typeof codeBuildStackEnvSchema>;
export const codeBuildStackCodeBuildEnv = (env: CodeBuildStackEnv): CodeBuildEnv =>
  toCodeBuildEnv<CodeBuildStackEnv>(codeBuildStackEnvSchema.parse(env));
