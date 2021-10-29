const requireEnv = <NAME extends string>(name: NAME): { [name in NAME]: string } => {
  const value = process.env[name] as string | undefined;
  if (typeof value !== 'string') throw new TypeError(`${name} is not string`);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any
  return { [name]: value } as any;
};

export interface Env {
  AWS_PROFILE?: string;
  API_BUILD_PROJECT_NAME: string;
  ENV_DEPLOY_PROJECT_NAME: string;
  API_REPO_NAME: string;
  TABLE_NAME: string;
  SSM_PREFIX: string;
}
export const requireEnvVars = (): Env => {
  const { AWS_PROFILE } = process.env;
  const { SSM_PREFIX } = requireEnv('SSM_PREFIX');
  const { TABLE_NAME } = requireEnv('TABLE_NAME');
  const { API_BUILD_PROJECT_NAME } = requireEnv('API_BUILD_PROJECT_NAME');
  const { ENV_DEPLOY_PROJECT_NAME } = requireEnv('ENV_DEPLOY_PROJECT_NAME');
  const { API_REPO_NAME } = requireEnv('API_REPO_NAME');

  return {
    AWS_PROFILE,
    ENV_DEPLOY_PROJECT_NAME,
    SSM_PREFIX,
    API_BUILD_PROJECT_NAME,
    API_REPO_NAME,
    TABLE_NAME,
  };
};
