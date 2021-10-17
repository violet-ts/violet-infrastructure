import { config, SharedIniFileCredentials, RemoteCredentials } from 'aws-sdk';
import type { Env } from './env-vars';

export const configureAws = (env: Env): void => {
  const { AWS_PROFILE } = env;
  // TODO(hardcoded)
  config.region = 'ap-northeast-1';
  if (typeof AWS_PROFILE === 'string') {
    config.credentials = new SharedIniFileCredentials({ profile: AWS_PROFILE });
  } else {
    config.credentials = new RemoteCredentials();
  }
};
