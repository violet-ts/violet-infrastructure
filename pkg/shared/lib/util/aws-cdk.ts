import type { CodeBuild } from '@cdktf/provider-aws';

export type CodeBuildEnv = Array<CodeBuild.CodebuildProjectEnvironmentEnvironmentVariable>;
export const toCodeBuildEnv = <T>(env: T): CodeBuildEnv => {
  return Object.entries(env).map(([name, value]) => {
    return { name, value };
  });
};
