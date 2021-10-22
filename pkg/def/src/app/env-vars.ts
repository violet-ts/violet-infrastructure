export interface SharedEnv {
  AWS_ACCOUNT_ID: string;
  AWS_PROFILE?: string;
  DOCKERHUB?:
    | {
        USER: string;
        PASS: string;
      }
    | undefined;
}
export const requireSharedEnvVars = (): SharedEnv => {
  const { AWS_ACCOUNT_ID, AWS_PROFILE, DOCKERHUB_USER, DOCKERHUB_PASS } = process.env;
  if (typeof AWS_ACCOUNT_ID !== 'string') throw new TypeError('AWS_ACCOUNT_ID is not string');
  if ((typeof DOCKERHUB_USER !== 'string') !== (typeof DOCKERHUB_PASS !== 'string'))
    throw new Error('both DOCKERHUB_USER and DOCKERHUB_PASS should exist or absent');
  const DOCKERHUB =
    typeof DOCKERHUB_USER === 'string' && typeof DOCKERHUB_PASS === 'string'
      ? { USER: DOCKERHUB_USER, PASS: DOCKERHUB_PASS }
      : undefined;

  return {
    AWS_ACCOUNT_ID,
    AWS_PROFILE,
    DOCKERHUB,
  };
};

export interface DevEnv {
  ECR_API_DEV_NAME: string;
}
export const requireDevEnvVars = (): DevEnv => {
  const { ECR_API_DEV_NAME } = process.env;
  if (typeof ECR_API_DEV_NAME !== 'string') throw new TypeError('ECR_API_DEV_NAME is not string');
  return {
    ECR_API_DEV_NAME,
  };
};

export interface ProdEnv {
  ECR_API_PROD_NAME: string;
}
export const requireProdEnvVars = (): ProdEnv => {
  const { ECR_API_PROD_NAME } = process.env;
  if (typeof ECR_API_PROD_NAME !== 'string') throw new TypeError('ECR_API_PROD_NAME is not string');

  return {
    ECR_API_PROD_NAME,
  };
};
