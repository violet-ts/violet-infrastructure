import { Temporal } from '@js-temporal/polyfill';
import { findCmdByName, runMain } from '@self/bot/src/app/cmd';
import type { BoundReplyCmd, CmdStatus, CommandContext, CommentHint, GeneralEntry } from '@self/bot/src/type/cmd';
import { cmdStatusSchema } from '@self/bot/src/type/cmd';
import { renderProcessingDuration } from '@self/bot/src/util/comment-render';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

export const doneChildSchema = z.object({
  name: z.string(),
  boundArgs: z.array(z.string()),
  startedAt: z.number(),
  updatedAt: z.number(),
  status: cmdStatusSchema,
  lastComment: z.string(),
});
export type DoneChild = z.infer<typeof doneChildSchema>;

export const processingChildSchema = z.object({
  name: z.string(),
  boundArgs: z.array(z.string()),
  entryUUID: z.string(),
  status: cmdStatusSchema,
});
export type ProcessingChild = z.infer<typeof processingChildSchema>;

export const waitChildSchema = z.object({
  name: z.string(),
  boundArgs: z.array(z.string()),
});
export type WaitChild = z.infer<typeof waitChildSchema>;

export type ResultTouched = {
  watchTriggers?: Set<string> | null | undefined;
  footBadges?: Map<string, string> | null | undefined;
};

export const unmarshallMetaArgs = (args: string[]): BoundReplyCmd[] => {
  return args.map((a): BoundReplyCmd => {
    const [name, ...argv] = z.array(z.string()).parse(JSON.parse(a));
    const cmd = findCmdByName(name);
    return {
      cmd,
      boundArgs: argv,
    };
  });
};

export const marshallMetaArgs = (cmds: BoundReplyCmd[]): string[] => {
  return cmds.map((b): string => {
    return JSON.stringify([b.cmd.name, ...b.boundArgs]);
  });
};

export const emojiStatus = (status: CmdStatus | undefined): string => {
  switch (status) {
    case 'undone':
      return '▶️';
    case 'success':
      return '✅';
    case 'failure':
      return '❌';
    default:
      return '⏹️';
  }
};

export type TriggerCollector = {
  collectedTriggers: Set<string>;
  collectedFootBadges: Map<string, string>;
  touchResult: (result: ResultTouched) => void;
};
export const createTriggerCollector = (): TriggerCollector => {
  const collectedTriggers = new Set<string>();
  const collectedFootBadges = new Map<string, string>();
  const touchResult = ({ watchTriggers, footBadges }: ResultTouched): void => {
    if (watchTriggers) {
      [...watchTriggers].forEach((trigger) => collectedTriggers.add(trigger));
      watchTriggers.clear();
    }
    if (footBadges) {
      [...footBadges].forEach(([key, value]) => collectedFootBadges.set(key, value));
      footBadges.clear();
    }
  };
  return { collectedTriggers, collectedFootBadges, touchResult };
};

export type StatusCounter = {
  add: (status: CmdStatus | 'wait') => void;
  get: (status: CmdStatus | 'wait') => number;
  summary: () => CmdStatus;
};
export const createStatusCounter = (): StatusCounter => {
  const counter: Record<CmdStatus | 'wait', number> = {
    wait: 0,
    undone: 0,
    failure: 0,
    success: 0,
  };
  const add = (status: CmdStatus | 'wait'): void => {
    counter[status] += 1;
  };
  const get = (status: CmdStatus | 'wait'): number => {
    return counter[status];
  };
  const summary = (): CmdStatus => {
    if (counter.failure) return 'failure';
    if (counter.undone) return 'undone';
    if (counter.wait) return 'undone';
    return 'success';
  };
  return {
    add,
    get,
    summary,
  };
};

export interface RunMainWrapperParams {
  ctx: CommandContext;
  add: StatusCounter['add'];
  boundCmd: BoundReplyCmd;
  rootGeneralEntry: GeneralEntry;
  touchResult: TriggerCollector['touchResult'];
}
interface RunMainWrapperResult {
  done: DoneChild;
  processing: ProcessingChild;
  status: CmdStatus;
}
export const runMainWrapper = async ({
  ctx,
  add,
  boundCmd,
  rootGeneralEntry,
  touchResult,
}: RunMainWrapperParams): Promise<RunMainWrapperResult> => {
  const uuid = uuidv4();
  const startedAt = Temporal.Now.instant().epochMilliseconds;
  const generalEntry = {
    ...rootGeneralEntry,
    name: boundCmd.cmd.name,
    uuid,
    startedAt,
    updatedAt: startedAt,
  };
  const { status, comment } = await runMain(boundCmd.cmd, ctx, boundCmd.boundArgs, generalEntry, false, touchResult);
  add(status);
  const done: DoneChild = {
    name: boundCmd.cmd.name,
    boundArgs: boundCmd.boundArgs,
    startedAt,
    updatedAt: startedAt,
    status,
    lastComment: comment,
  };
  const processing: ProcessingChild = {
    name: boundCmd.cmd.name,
    boundArgs: boundCmd.boundArgs,
    entryUUID: uuid,
    status,
  };

  return {
    done,
    processing,
    status,
  };
};

export const constructDoneChild = (child: DoneChild): CommentHint => ({
  title: `${emojiStatus(child.status)} ${child.name} ${renderProcessingDuration(
    child.status,
    Temporal.Instant.fromEpochMilliseconds(child.startedAt),
    Temporal.Instant.fromEpochMilliseconds(child.updatedAt),
  )}`,
  body: { main: [child.lastComment] },
});
