const requireEnv = <NAME extends string>(name: NAME): { [name in NAME]: string } => {
  const value = process.env[name] as string | undefined;
  if (typeof value !== 'string') throw new TypeError(`${name} is not string`);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any
  return { [name]: value } as any;
};

export interface Env {
  API_BUILD_PROJECT_NAME: string;
  TABLE_NAME: string;
  SSM_PREFIX: string;
  AWS_PROFILE?: string;
}
export const requireEnvVars = (): Env => {
  const { AWS_PROFILE } = process.env;
  const { SSM_PREFIX } = requireEnv('SSM_PREFIX');
  const { API_BUILD_PROJECT_NAME } = requireEnv('API_BUILD_PROJECT_NAME');
  const { TABLE_NAME } = requireEnv('TABLE_NAME');

  return {
    AWS_PROFILE,

    SSM_PREFIX,
    API_BUILD_PROJECT_NAME,
    TABLE_NAME,
  };
};
