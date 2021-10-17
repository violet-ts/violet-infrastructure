import type { Context as LambdaContext } from 'aws-lambda';
import type { Logger } from 'winston';
import type { Env } from '../app/env-vars';
import type { GeneralEntry } from './cmd';

export type BasicContext = {
  env: Env;
  logger: Logger;
};

export interface CallbackHandler {
  handle(ctx: BasicContext, event: unknown, context: LambdaContext): Promise<null | GeneralEntry>;
}
