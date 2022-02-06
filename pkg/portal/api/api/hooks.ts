import type { Credentials, Provider } from '@aws-sdk/types';
import { getLambdaCredentials } from '@self/shared/lib/aws';
import type { PortalEnv } from '@self/shared/lib/portal/lambda/env';
import { portalEnvSchema } from '@self/shared/lib/portal/lambda/env';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { defineHooks } from './$relay';

export type AdditionalRequest = {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
  userPayload: CognitoIdTokenPayload | null;
};

export default defineHooks(() => ({
  onRequest: async (req, _res, done) => {
    const env = portalEnvSchema.parse(process.env);
    const verifier = CognitoJwtVerifier.create({
      userPoolId: env.PORTAL_USER_POOL_ID,
      tokenUse: 'id',
      clientId: env.PORTAL_USER_POOL_WEB_CLIENT_ID,
    });

    const getUserPayload = async (authorization: string | undefined | null): Promise<CognitoIdTokenPayload | null> => {
      if (typeof authorization !== 'string') return null;
      const [name, token] = authorization.trim().split(/\s+/);
      if (name !== 'Bearer') return null;
      try {
        const payload = await verifier.verify(token);
        return payload;
      } catch (e: unknown) {
        // eslint-disable-next-line no-console
        console.error(e);
        return null;
      }
    };

    const authorization = req.headers.authorization;
    const userPayload = await getUserPayload(authorization);
    const credentials = getLambdaCredentials();
    Object.assign(req, {
      env,
      credentials,
      userPayload,
    });
    done();
  },
}));
