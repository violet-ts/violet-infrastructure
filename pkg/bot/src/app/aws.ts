import { fromIni, fromEnv, fromContainerMetadata } from '@aws-sdk/credential-providers';
import type { Credentials, Provider } from '@aws-sdk/types';

export const getLambdaCredentials = (): Credentials | Provider<Credentials> => {
  const { AWS_PROFILE } = process.env;
  if (AWS_PROFILE) {
    return fromIni({ profile: AWS_PROFILE });
  }
  return fromEnv();
};

export const getCodeBuildCredentials = (): Credentials | Provider<Credentials> => {
  const { AWS_PROFILE } = process.env;
  if (AWS_PROFILE) {
    return fromIni({ profile: AWS_PROFILE });
  }
  return fromContainerMetadata();
};
