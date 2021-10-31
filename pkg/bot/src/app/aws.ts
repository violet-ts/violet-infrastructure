import { config, SharedIniFileCredentials, RemoteCredentials } from 'aws-sdk';

export const configureAws = (): void => {
  const { AWS_PROFILE } = process.env;
  // TODO(hardcoded)
  config.region = 'ap-northeast-1';
  if (typeof AWS_PROFILE === 'string') {
    config.credentials = new SharedIniFileCredentials({ profile: AWS_PROFILE });
  } else {
    config.credentials = new RemoteCredentials();
  }
};
