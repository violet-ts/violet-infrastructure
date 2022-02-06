import configureApp from '@portal/api/$server';
import cors from 'cors';
import express from 'express';

export const initApp = (): express.Express => {
  const app = express();
  app.use(cors());
  configureApp(app);
  return app;
};
