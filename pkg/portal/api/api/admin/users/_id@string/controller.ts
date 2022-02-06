import { addUser, deleteUser, ensureAndGetUser, setUserRole } from '@portal/api/src/util/user';
import { defineController } from './$relay';

export default defineController(() => ({
  post: async ({ params: { id }, env, credentials }) => {
    await addUser({
      env,
      credentials,
      email: id,
    });
    return { status: 200 };
  },
  delete: async ({ params: { id }, env, credentials, userPayload }) => {
    const senderEmail = userPayload.email as string;
    if (senderEmail === id) {
      return {
        status: 400,
      };
    }
    const user = await ensureAndGetUser({ email: id, env, credentials });
    if (user.role === 'admin') {
      return {
        status: 400,
      };
    }
    await deleteUser({
      env,
      credentials,
      email: id,
    });
    return { status: 200, body: {} };
  },
  patch: async ({ params: { id }, body: { role }, env, credentials, userPayload }) => {
    const senderEmail = userPayload.email as string;
    if (senderEmail === id) {
      return {
        status: 400,
      };
    }
    if (role !== 'normal' && role !== 'admin') {
      return {
        status: 400,
      };
    }
    await setUserRole({
      env,
      credentials,
      email: id,
      role,
    });
    return { status: 200, body: {} };
  },
}));
