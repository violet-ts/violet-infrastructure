export interface SharedEnv {
  AWS_ACCOUNT_ID: string;
  AWS_PROFILE?: string;
}
export const requireSharedEnvVars = (): SharedEnv => {
  const { AWS_ACCOUNT_ID, AWS_PROFILE } = process.env;
  if (typeof AWS_ACCOUNT_ID !== 'string') throw new TypeError('AWS_ACCOUNT_ID is not string');

  return {
    AWS_ACCOUNT_ID,
    AWS_PROFILE,
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
