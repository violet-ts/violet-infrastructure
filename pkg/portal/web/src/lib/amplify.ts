import type { CognitoUser, CognitoUserSession } from 'amazon-cognito-identity-js';
import Amplify from 'aws-amplify';

if (typeof window !== 'undefined') {
  // TODO(hardcoded): region
  const region = 'ap-northeast-1';
  const userPoolId = process.env.NEXT_PUBLIC_PORTAL_USER_POOL_ID;
  const userPoolWebClientId = process.env.NEXT_PUBLIC_PORTAL_USER_POOL_WEB_CLIENT_ID;
  Amplify.configure({
    Auth: {
      region,
      userPoolId,
      userPoolWebClientId,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    (window as any).Amplify = Amplify;
  }
}

export const answerCustomChallenge = async (cognitoUser: CognitoUser, answer: string): Promise<CognitoUserSession> => {
  await Amplify.Auth.sendCustomChallengeAnswer(cognitoUser, answer);
  return await Amplify.Auth.currentSession();
};

export { Amplify };
