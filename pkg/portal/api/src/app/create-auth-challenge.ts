import type { SendEmailCommandInput } from '@aws-sdk/client-ses';
import { SES } from '@aws-sdk/client-ses';
import { fromEnv } from '@aws-sdk/credential-providers';
import type { CreateAuthChallengeEnv } from '@self/shared/lib/portal/auth/env';
import { createAuthChallengeEnvSchema } from '@self/shared/lib/portal/auth/env';
import type { CreateAuthChallengeTriggerHandler } from 'aws-lambda';
import { randomDigits } from 'crypto-secure-random-digit';

const credentials = fromEnv();
const ses = new SES({ credentials });

// https://aws.amazon.com/blogs/mobile/implementing-passwordless-email-authentication-with-amazon-cognito/
export const handler: CreateAuthChallengeTriggerHandler = async (event) => {
  const env = createAuthChallengeEnvSchema.parse(process.env);
  let secretLoginCode: string;
  if (!event.request.session || !event.request.session.length) {
    secretLoginCode = randomDigits(6).join('');
    await sendEmail({
      emailAddress: event.request.userAttributes.email,
      secretLoginCode,
      env,
    });
  } else {
    const previousChallenge = event.request.session.slice(-1)[0];
    secretLoginCode = previousChallenge.challengeMetadata!.match(/CODE-(\d*)/)![1];
  }

  event.response.publicChallengeParameters = {
    email: event.request.userAttributes.email,
  };

  event.response.privateChallengeParameters = { secretLoginCode };

  event.response.challengeMetadata = `CODE-${secretLoginCode}`;

  return event;
};

interface SendEmailParams {
  emailAddress: string;
  secretLoginCode: string;
  env: CreateAuthChallengeEnv;
}
const sendEmail = async ({ emailAddress, secretLoginCode, env }: SendEmailParams) => {
  const params: SendEmailCommandInput = {
    Destination: { ToAddresses: [emailAddress] },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: `
          <html>
            <body>
              <p>Violet開発ポータルへのログイン用のシークレットコードです。</p>
              <p>コード:</p>
              <h3>${secretLoginCode}</h3>
              <p>Copyright &copy; frourio株式会社 2022</p>
            </body>
          </html>`,
        },
        Text: {
          Charset: 'UTF-8',
          Data: [
            'Violet開発ポータルへのログイン用のシークレットコードです。',
            `コード: ${secretLoginCode}`,
            'Copyright © frourio株式会社 2022',
          ].join('\n'),
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: '[Violet開発ポータル] ログイン用のシークレットコード',
      },
    },
    Source: env.SES_FROM_ADDRESS,
  };
  await ses.sendEmail(params);
};
