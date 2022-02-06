import type { UserStatus } from '@portal/api/src/util/user';

export type Methods = {
  get: {
    resBody: {
      users: UserStatus[];
    };
  };
};
