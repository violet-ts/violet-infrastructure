import type { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { Forbidden } from 'http-errors';
import { defineHooks } from './$relay';

export type AdditionalRequest = {
  userPayload: CognitoIdTokenPayload;
};

export default defineHooks(() => ({
  onRequest(req, _res, done) {
    if (req.userPayload == null) {
      done(new Forbidden());
      return;
    }
    done();
  },
}));
