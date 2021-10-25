const requireEnv = <NAME extends string>(name: NAME): { [name in NAME]: string } => {
  const value = process.env[name] as string | undefined;
  if (typeof value !== 'string') throw new TypeError(`${name} is not string`);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any
  return { [name]: value } as any;
};

export interface SharedEnv {
  AWS_ACCOUNT_ID: string;
  AWS_PROFILE?: string;
  /** 事前に作成した AWS Route53 Zone */
  PREVIEW_ZONE_ID: string;
  DOCKERHUB?:
    | {
        USER: string;
        PASS: string;
      }
    | undefined;
}
export const requireSharedEnvVars = (): SharedEnv => {
  const { AWS_PROFILE, DOCKERHUB_USER, DOCKERHUB_PASS } = process.env;
  const { AWS_ACCOUNT_ID } = requireEnv('AWS_ACCOUNT_ID');
  if ((typeof DOCKERHUB_USER !== 'string') !== (typeof DOCKERHUB_PASS !== 'string'))
    throw new Error('both DOCKERHUB_USER and DOCKERHUB_PASS should exist or absent');
  const DOCKERHUB =
    typeof DOCKERHUB_USER === 'string' && typeof DOCKERHUB_PASS === 'string'
      ? { USER: DOCKERHUB_USER, PASS: DOCKERHUB_PASS }
      : undefined;
  const { PREVIEW_ZONE_ID } = requireEnv('PREVIEW_ZONE_ID');

  return {
    AWS_ACCOUNT_ID,
    AWS_PROFILE,
    PREVIEW_ZONE_ID,
    DOCKERHUB,
  };
};

export interface DevEnv {
  ECR_API_DEV_NAME: string;
}
export const requireDevEnvVars = (): DevEnv => {
  const { ECR_API_DEV_NAME } = requireEnv('ECR_API_DEV_NAME');
  return {
    ECR_API_DEV_NAME,
  };
};

export interface ProdEnv {
  ECR_API_PROD_NAME: string;
}
export const requireProdEnvVars = (): ProdEnv => {
  const { ECR_API_PROD_NAME } = requireEnv('ECR_API_PROD_NAME');
  return {
    ECR_API_PROD_NAME,
  };
};

export interface EnvEnv {
  MYSQL_PARAM_JSON: string;
  NAMESPACE: string;
  CIDR_NUM: string;
  API_ECR_NAME: string;
}
export const requireEnvEnvVars = (): EnvEnv => {
  const { MYSQL_PARAM_JSON } = requireEnv('MYSQL_PARAM_JSON');
  const { NAMESPACE } = requireEnv('NAMESPACE');
  const { CIDR_NUM } = requireEnv('CIDR_NUM');
  const { API_ECR_NAME } = requireEnv('API_ECR_NAME');
  if (!/[a-z][a-z0-9]*/.test(NAMESPACE)) throw new Error(`env NAMESPACE="${NAMESPACE}" is bad`);
  return {
    MYSQL_PARAM_JSON,
    NAMESPACE,
    CIDR_NUM,
    API_ECR_NAME,
  };
};
