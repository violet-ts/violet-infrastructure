import type { Octokit } from '@octokit/rest';
import type { IssueCommentEvent } from '@octokit/webhooks-types';
import type { Logger } from 'winston';
import { z } from 'zod';
import type { Env } from '../app/env-vars';

export type BasicContext = {
  octokit: Octokit;
  env: Env;
  logger: Logger;
};

export type CommandContext = {
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
});
export type GeneralEntry = z.infer<typeof generalEntrySchema>;

type ReplyCmdMainResult<Entry = Record<never, never>, CommentValues = undefined> = {
  save: boolean;
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
  main: (string | boolean | null | undefined)[];
  hints?: (CommentHint | boolean | null | undefined)[];
}

export interface UpdateResult<Entry = Record<never, never>, CommentValues = undefined> {
  entry: Entry;
  values: CommentValues;
}

export type ReplyCmd<Entry = { _keyForTypeCheck: string }, CommentValues = unknown> = {
  name: string;
  where: 'any' | 'pr' | 'issue';
  description: string;
  hidden: boolean;
  entrySchema: z.ZodTypeAny;
  main: (
    ctx: CommandContext,
    args: string[],
  ) => ReplyCmdMainResult<Entry, CommentValues> | Promise<ReplyCmdMainResult<Entry, CommentValues>>;
  constructComment: (entry: Entry & GeneralEntry, commentValues: CommentValues, ctx: BasicContext) => CommentBody;
  update?: (
    entry: Entry & GeneralEntry,
    ctx: BasicContext,
  ) => UpdateResult<Entry, CommentValues> | Promise<UpdateResult<Entry, CommentValues>>;
};
