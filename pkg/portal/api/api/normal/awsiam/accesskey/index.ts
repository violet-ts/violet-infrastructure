import type { IAMSecret } from '@portal/api/src/util/awsiam';

export type Methods = {
  get: {
    resBody: {
      id: string | null;
    };
  };
  post: {
    resBody: {
      secret: IAMSecret;
    };
  };
  delete: {};
};
