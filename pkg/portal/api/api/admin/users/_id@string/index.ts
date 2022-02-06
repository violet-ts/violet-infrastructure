import type { Role } from '@portal/api/src/util/user';

export type Methods = {
  post: {};
  delete: {};
  patch: {
    reqBody: {
      role: Role;
    };
  };
};
