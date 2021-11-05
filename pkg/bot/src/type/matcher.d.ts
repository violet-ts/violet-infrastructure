import type { Context as LambdaContext } from 'aws-lambda';
import type { Logger } from 'winston';
import type { ComputedBotEnv } from '@self/shared/lib/bot/env';
import type { Credentials, Provider } from '@aws-sdk/types';

export type MatcherBasicContext = {
  env: ComputedBotEnv;
  credentials: Credentials | Provider<Credentials>;
  logger: Logger;
};

export interface CallbackMatcher {
  name: string;
  handle(ctx: MatcherBasicContext, event: unknown, context: LambdaContext): Promise<unknown>;
}
