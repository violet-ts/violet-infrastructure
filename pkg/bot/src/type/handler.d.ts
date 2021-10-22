import type { Context as LambdaContext } from 'aws-lambda';
import type { Logger } from 'winston';
import type { Env } from '../app/env-vars';

export type BasicContext = {
  env: Env;
  logger: Logger;
};

export interface CallbackHandler {
  name: string;
  handle(ctx: BasicContext, event: unknown, context: LambdaContext): Promise<unknown>;
}
