import type { Octokit } from '@octokit/rest';
import type { IssueCommentEvent } from '@octokit/webhooks-types';
import type { Logger } from 'winston';
import { z } from 'zod';
import type { Credentials, Provider } from '@aws-sdk/types';
import type { ComputedBotEnv, ComputedAfterwardBotEnv } from '@self/shared/lib/bot/env';
import type arg from 'arg';

export type BasicContext = {
  octokit: Octokit;
  env: ComputedBotEnv & ComputedAfterwardBotEnv;
  credentials: Credentials | Provider<Credentials>;
  logger: Logger;
};

export type CommandContext = {
  namespace: string;
  originalArgs: string[];
  commentPayload: IssueCommentEvent;
} & BasicContext;

export const generalEntrySchema = z.object({
  uuid: z.string(),
  ttl: z.number(),
  name: z.string(),
  lastUpdate: z.number(),
  callerId: z.number(),
  callerName: z.string(),
  commentOwner: z.string(),
  commentRepo: z.string(),
  commentIssueNumber: z.number(),
  commentId: z.number(),
  namespace: z.string(),
  botInstallationId: z.number(),
});
export type GeneralEntry = z.infer<typeof generalEntrySchema>;

type ReplyCmdMainResult<Entry = Record<never, never>, CommentValues = undefined> = {
  status: CmdStatus;
  entry: Entry;
  values: CommentValues;
};

export interface CommentHint {
  /**
   * インラインコードには `<code>` を使う
   */
  title: string;
  body: CommentBody;
}

export interface CommentBody {
  main: (string | boolean | number | null | undefined)[];
  hints?: (CommentHint | boolean | number | null | undefined)[];
}

export interface UpdateResult<Entry = Record<never, never>, CommentValues = undefined> {
  status: CmdStatus;
  entry: Entry;
  values: CommentValues;
}

export type ReplyCmdStatic = {
  name: string;
  description: string;
  hidden: boolean;
};

export type GeneralArgSchema = {
  '--ns': StringConstructor;
};

export type ReplyCmd<
  Entry = { _keyForTypeCheck: string },
  CommentValues = unknown,
  ArgSchema = { ['--keyForTypeCheck']: StringConstructor },
> = ReplyCmdStatic & {
  entrySchema: z.ZodTypeAny;
  argSchema: ArgSchema;
  main: (
    ctx: CommandContext,
    args: arg.Result<GeneralArgSchema & ArgSchema>,
    generalEntry: GeneralEntry,
  ) => ReplyCmdMainResult<Entry, CommentValues> | Promise<ReplyCmdMainResult<Entry, CommentValues>>;
  constructComment: (entry: Entry & GeneralEntry, commentValues: CommentValues, ctx: BasicContext) => CommentBody;
  update?: (
    entry: Entry & GeneralEntry,
    ctx: BasicContext,
  ) => UpdateResult<Entry, CommentValues> | Promise<UpdateResult<Entry, CommentValues>>;
};

export type CmdStatus = 'undone' | 'success' | 'failure';
