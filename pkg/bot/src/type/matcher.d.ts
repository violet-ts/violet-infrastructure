import type { Context as LambdaContext } from 'aws-lambda';
import type { Logger } from 'winston';
import type { Env } from '../app/env-vars';

export type MatcherBasicContext = {
  env: Env;
  logger: Logger;
};

export interface CallbackMatcher {
  name: string;
  handle(ctx: MatcherBasicContext, event: unknown, context: LambdaContext): Promise<unknown>;
}
