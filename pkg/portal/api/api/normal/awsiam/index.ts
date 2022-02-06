import type { IAMUser } from '@portal/api/src/util/awsiam';

export type Methods = {
  get: {
    resBody: {
      iamUser: IAMUser | null;
    };
  };
  post: {};
  delete: {};
};
