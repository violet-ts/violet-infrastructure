import { z } from 'zod';

// https://docs.aws.amazon.com/ja_jp/codebuild/latest/userguide/build-env-ref-env-vars.html

export const codeBuildEnvSchema = z.object({
  CODEBUILD_BUILD_ID: z.string(),
});
export type CodeBuildEnv = z.infer<typeof codeBuildEnvSchema>;
