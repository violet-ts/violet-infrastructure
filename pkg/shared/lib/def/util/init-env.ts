import * as dotenv from 'dotenv';
import * as path from 'path';

export const initEnv = (): void => {
  dotenv.config({
    path: path.resolve(__dirname, '..', '..', '..', '..', '..', '.env.local'),
  });
};
