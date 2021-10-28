export type EnvEnv = Record<'MYSQL_PARAM_JSON' | 'NAMESPACE' | 'CIDR_NUM' | 'API_REPO_NAME' | 'API_REPO_SHA', string>;

export type BotSideEnvEnv = Pick<EnvEnv, 'NAMESPACE' | 'API_REPO_SHA'>;

export type DefSideEnvEnv = Omit<EnvEnv, keyof BotSideEnvEnv>;
