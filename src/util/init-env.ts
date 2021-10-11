import * as path from 'path';
import * as dotenv from 'dotenv';

export interface InitEnvOptions {
  development: boolean;
  produciton: boolean;
}
export const initEnv = (options: InitEnvOptions): void => {
  if (options.produciton) {
    dotenv.config({
      path: path.resolve(__dirname, '../.env.production'),
    });
  }
  if (options.development) {
    dotenv.config({
      path: path.resolve(__dirname, '../.env.development'),
    });
  }
  dotenv.config({
    path: path.resolve(__dirname, '../.env.local'),
  });
};
