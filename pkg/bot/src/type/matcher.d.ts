import type { Context as LambdaContext } from 'aws-lambda';
import type { Logger } from 'winston';
import type { ComputedBotEnv } from '@self/shared/lib/bot-env';

export type MatcherBasicContext = {
  env: ComputedBotEnv;
  logger: Logger;
};

export interface CallbackMatcher {
  name: string;
  handle(ctx: MatcherBasicContext, event: unknown, context: LambdaContext): Promise<unknown>;
}
