import * as path from 'path';
import * as dotenv from 'dotenv';

export const initEnv = (): void => {
  dotenv.config({
    path: path.resolve(__dirname, '..', '..', '..', '..', '..', '.env.local'),
  });
};
