import { createIAMUserKey, deleteIAMUserKey, getIAMUser, getIAMUserKeyId } from '@portal/api/src/util/awsiam';
import { defineController } from './$relay';

export default defineController(() => ({
  get: async ({ env, credentials, userPayload }) => {
    const email = userPayload.email as string;
    const user = await getIAMUser({ env, credentials, email });
    if (user == null) return { status: 200, body: { id: null } };
    const id = await getIAMUserKeyId({ env, credentials, email });
    return { status: 200, body: { id } };
  },
  post: async ({ env, credentials, userPayload }) => {
    const email = userPayload.email as string;
    const secret = await createIAMUserKey({ env, credentials, email });
    return { status: 200, body: { secret } };
  },
  delete: async ({ env, credentials, userPayload }) => {
    const email = userPayload.email as string;
    await deleteIAMUserKey({ env, credentials, email });
    return { status: 200 };
  },
}));
