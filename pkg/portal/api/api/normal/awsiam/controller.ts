import { createIAMUser, deleteIAMUser, getIAMUser } from '@portal/api/src/util/awsiam';
import { defineController } from './$relay';

export default defineController(() => ({
  get: async ({ env, credentials, userPayload }) => {
    const email = userPayload.email as string;
    const iamUser = await getIAMUser({ env, credentials, email });
    return { status: 200, body: { iamUser } };
  },
  post: async ({ env, credentials, userPayload }) => {
    const email = userPayload.email as string;
    await createIAMUser({ env, credentials, email });
    return { status: 200 };
  },
  delete: async ({ env, credentials, userPayload }) => {
    const email = userPayload.email as string;
    await deleteIAMUser({ env, credentials, email });
    return { status: 200 };
  },
}));
