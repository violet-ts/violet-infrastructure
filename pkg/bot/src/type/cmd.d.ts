import type { Octokit } from '@octokit/rest';
import type { IssueCommentEvent } from '@octokit/webhooks-types';
import type { Logger } from 'winston';
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

export type GeneralEntry<Name extends string = string> = {
  uuid: string;
  name: Name;
  lastUpdate: string;
  callerId: number;
  callerName: string;
  commentOwner: string;
  commentRepo: string;
  commentIssueNumber: number;
  commentId: number;
};

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

export type ReplyCmd<Name extends string = string, Entry = Record<never, never>, CommentValues = undefined> = {
  cmd: Name;
  where: 'any' | 'pr' | 'issue';
  description: string;
  hidden: boolean;
  main: (
    ctx: CommandContext,
    args: string[],
  ) => ReplyCmdMainResult<Entry, CommentValues> | Promise<ReplyCmdMainResult<Entry, CommentValues>>;
  constructComment: (entry: Entry & GeneralEntry<Name>, commentValues: CommentValues, ctx: BasicContext) => CommentBody;
  update?: (
    entry: Entry & GeneralEntry<Name>,
    ctx: BasicContext,
  ) => UpdateResult<Entry, CommentValues> | Promise<UpdateResult<Entry, CommentValues>>;
};
