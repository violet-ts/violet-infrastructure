import { ensureAndGetUser } from '@portal/api/src/util/user';
import { defineController } from './$relay';

export default defineController(() => ({
  get: async ({ env, credentials, userPayload }) => {
    const user = await ensureAndGetUser({ email: userPayload.email as string, env, credentials });
    return {
      status: 200,
      body: {
        role: user.role,
      },
    };
  },
}));
