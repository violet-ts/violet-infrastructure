import type { codebuild } from '@cdktf/provider-aws';

export type CodeBuildEnv = Array<codebuild.CodebuildProjectEnvironmentEnvironmentVariable>;
export const toCodeBuildEnv = <T>(env: T): CodeBuildEnv => {
  return Object.entries(env).map(([name, value]) => {
    return { name, value };
  });
};
