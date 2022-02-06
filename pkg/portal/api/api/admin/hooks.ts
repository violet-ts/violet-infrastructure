import { ensureAndGetUser } from '@portal/api/src/util/user';
import type { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { Forbidden } from 'http-errors';
import { defineHooks } from './$relay';

export type AdditionalRequest = {
  userPayload: CognitoIdTokenPayload;
};

export default defineHooks(() => ({
  async onRequest(req, _res, done) {
    const { userPayload } = req;
    const env = req.env!;
    const credentials = req.credentials!;
    if (userPayload == null) {
      done(new Forbidden());
      return;
    }
    const user = await ensureAndGetUser({ email: userPayload.email as string, env, credentials });
    if (user.role !== 'admin') {
      done(new Forbidden());
      return;
    }
    done();
  },
}));
