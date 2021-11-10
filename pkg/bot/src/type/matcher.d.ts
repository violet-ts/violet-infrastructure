import type { Logger } from 'winston';
import type { Credentials, Provider } from '@aws-sdk/types';
import type { AccumuratedBotEnv } from '@self/shared/lib/bot/env';

export type MatcherBasicContext = {
  env: AccumuratedBotEnv;
  credentials: Credentials | Provider<Credentials>;
  logger: Logger;
};

export interface MatchResult {
  messages: unknown[];
  triggers: string[];
}

export interface CallbackMatcher {
  name: string;
  match(ctx: MatcherBasicContext, message: unknown): Promise<MatchResult>;
}
