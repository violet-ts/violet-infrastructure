import type { VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda';

// https://aws.amazon.com/blogs/mobile/implementing-passwordless-email-authentication-with-amazon-cognito/
export const handler: VerifyAuthChallengeResponseTriggerHandler = async (event) => {
  const expectedAnswer = event.request.privateChallengeParameters!.secretLoginCode;
  if (event.request.challengeAnswer === expectedAnswer) {
    event.response.answerCorrect = true;
  } else {
    event.response.answerCorrect = false;
  }
  return event;
};
