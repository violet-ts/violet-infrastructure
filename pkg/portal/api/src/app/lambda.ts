import { initApp } from '@portal/api/src/app/init-app';
import serverlessExpress from '@vendia/serverless-express';

const app = initApp();
export const handler = serverlessExpress({ app });
