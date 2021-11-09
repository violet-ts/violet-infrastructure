import type { Octokit } from '@octokit/rest';
import type { IssueCommentEvent } from '@octokit/webhooks-types';
import type { Logger } from 'winston';
import { z } from 'zod';
import type { Credentials, Provider } from '@aws-sdk/types';
import type { AccumuratedBotEnv } from '@self/shared/lib/bot/env';
import type arg from 'arg';

export type BasicContext = {
  octokit: Octokit;
  env: AccumuratedBotEnv;
  credentials: Credentials | Provider<Credentials>;
  logger: Logger;
};

export type CommandContext = {
  namespace: string;
  commentPayload: IssueCommentEvent;
} & BasicContext;

export const generalEntrySchema = z.object({
  uuid: z.string(),
  ttl: z.number(),
  name: z.string(),
  /** epoch miliseconds */
  startedAt: z.number(),
  /** epoch miliseconds */
  updatedAt: z.number(),
  callerId: z.number(),
  callerName: z.string(),
  commentOwner: z.string(),
  commentRepo: z.string(),
  commentIssueNumber: z.number(),
  commentId: z.number(),
  namespace: z.string(),
  botInstallationId: z.number(),
  watchArns: z.optional(z.nullable(z.set(z.string()))),
});
export type GeneralEntry = z.infer<typeof generalEntrySchema>;
export type CommentValuesForTypeCheck = { _cvKeyForTypeCheck: string };

export type ReplyCmdMainResult<Entry = { _keyForTypeCheck: string }, CommentValues = CommentValuesForTypeCheck> = {
  status: CmdStatus;
  entry: Entry;
  values: CommentValues;
  watchArns?: Set<string> | null | undefined;
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
  mode?: 'ul' | 'ol' | 'li-only' | 'plain';
  hints?: (CommentHint | boolean | number | null | undefined)[];
}

export interface UpdateResult<Entry = Record<never, never>, CommentValues = CommentValuesForTypeCheck> {
  status: CmdStatus;
  entry: Entry;
  values: CommentValues;
  watchArns?: Set<string> | null | undefined;
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
  CommentValues = CommentValuesForTypeCheck,
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

export type BoundReplyCmd = {
  cmd: ReplyCmd;
  boundArgs: string[];
};

export const cmdStatusSchema = z.union([z.literal('undone'), z.literal('success'), z.literal('failure')]);
export type CmdStatus = z.infer<typeof cmdStatusSchema>;
