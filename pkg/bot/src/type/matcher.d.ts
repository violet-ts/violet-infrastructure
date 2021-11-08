import type { Context as LambdaContext } from 'aws-lambda';
import type { Logger } from 'winston';
import type { Credentials, Provider } from '@aws-sdk/types';
import type { AccumuratedBotEnv } from '@self/bot/src/type/cmd';

export type MatcherBasicContext = {
  env: AccumuratedBotEnv;
  credentials: Credentials | Provider<Credentials>;
  logger: Logger;
};

export interface CallbackMatcher {
  name: string;
  handle(ctx: MatcherBasicContext, event: unknown, context: LambdaContext): Promise<unknown>;
}
