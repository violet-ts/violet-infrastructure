import { listUsers } from '@portal/api/src/util/user';
import { defineController } from './$relay';

export default defineController(() => ({
  get: async ({ env, credentials }) => {
    const users = await listUsers({ env, credentials });
    return {
      status: 200,
      body: {
        users,
      },
    };
  },
}));
