import type { Role } from '@portal/api/src/util/user';

export type Methods = {
  get: {
    resBody: {
      role: Role;
    };
  };
};
