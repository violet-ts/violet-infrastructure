import type { Octokit } from '@octokit/rest';
import type { IssueCommentEvent } from '@octokit/webhooks-types';
import type { Logger } from 'winston';
import { z } from 'zod';
import type { ComputedBotEnv } from '@self/shared/lib/bot-env';

export type BasicContext = {
  octokit: Octokit;
  env: ComputedBotEnv;
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
  botInstallationId: z.string(),
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
  where: 'any' | 'pr' | 'issue';
  description: string;
  hidden: boolean;
};

export type ReplyCmd<Entry = { _keyForTypeCheck: string }, CommentValues = unknown> = ReplyCmdStatic & {
  entrySchema: z.ZodTypeAny;
  main: (
    ctx: CommandContext,
    args: string[],
    generalEntry: GeneralEntry,
  ) => ReplyCmdMainResult<Entry, CommentValues> | Promise<ReplyCmdMainResult<Entry, CommentValues>>;
  constructComment: (entry: Entry & GeneralEntry, commentValues: CommentValues, ctx: BasicContext) => CommentBody;
  update?: (
    entry: Entry & GeneralEntry,
    ctx: BasicContext,
  ) => UpdateResult<Entry, CommentValues> | Promise<UpdateResult<Entry, CommentValues>>;
};

export type CmdStatus = 'undone' | 'success' | 'failure';
