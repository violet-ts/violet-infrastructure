import { reEvaluateAndUpdate } from '@self/bot/src/app/update-cmd';
import type { ReplyCmd } from '@self/bot/src/type/cmd';
import { getEntryByUUID } from '@self/bot/src/util/aws/comment-db';
import { z } from 'zod';
import type { DoneChild, ProcessingChild } from './util';
import {
  constructDoneChild,
  createStatusCounter,
  createTriggerCollector,
  doneChildSchema,
  processingChildSchema,
  runMainWrapper,
  unmarshallMetaArgs,
} from './util';

const entrySchema = z.object({
  children: z.array(z.union([doneChildSchema, processingChildSchema])),
});
export type Entry = z.infer<typeof entrySchema>;

export interface CommentValues {
  children: DoneChild[];
}

export const argSchema = {} as const;
export type ArgSchema = typeof argSchema;

const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
  name: 'parallel',
  hidden: true,
  description: '',
  entrySchema,
  argSchema,
  async main(ctx, args, rootGeneralEntry) {
    const { collectedTriggers, collectedFootBadges, touchResult } = createTriggerCollector();
    const { add, summary } = createStatusCounter();
    const boundCmds = unmarshallMetaArgs(args._);
    const childrenEntriesValues = await Promise.all(
      boundCmds.map(
        async (boundCmd): Promise<{ entry: Entry['children'][number]; value: CommentValues['children'][number] }> => {
          const { done, processing, status } = await runMainWrapper({
            ctx,
            add,
            boundCmd,
            rootGeneralEntry,
            touchResult,
          });
          return {
            entry: status === 'undone' ? processing : done,
            value: done,
          };
        },
      ),
    );

    return {
      status: summary(),
      entry: {
        children: childrenEntriesValues.map((c) => c.entry),
      },
      values: {
        children: childrenEntriesValues.map((c) => c.value),
      },
      watchTriggers: collectedTriggers,
      footBadges: collectedFootBadges,
    };
  },
  constructComment(_rootEntry, values, _ctx) {
    return {
      main: [],
      mode: 'ul',
      hints: values.children.map(constructDoneChild),
    };
  },
  async update(rootEntry, ctx) {
    const { collectedTriggers, collectedFootBadges, touchResult } = createTriggerCollector();
    const { add, summary } = createStatusCounter();
    const childrenEntriesValues = await Promise.all(
      rootEntry.children.map(
        async (child): Promise<{ entry: Entry['children'][number]; value: CommentValues['children'][number] }> => {
          if ('entryUUID' in child) {
            const oldEntry = await getEntryByUUID({
              ...ctx,
              uuid: child.entryUUID,
            });
            const { newEntry, status, fullComment } = await reEvaluateAndUpdate(
              oldEntry,
              ctx.env,
              ctx.octokit,
              ctx.credentials,
              ctx.logger,
              false,
              touchResult,
            );

            const done: DoneChild = {
              name: child.name,
              boundArgs: child.boundArgs,
              startedAt: newEntry.startedAt,
              updatedAt: newEntry.updatedAt,
              status,
              lastComment: fullComment,
            };
            add(status);
            const processing: ProcessingChild = {
              ...child,
              status,
            };
            return {
              entry: status === 'undone' ? processing : done,
              value: done,
            };
          }
          add(child.status);
          return {
            entry: child,
            value: child,
          };
        },
      ),
    );
    return {
      status: summary(),
      updateEntry: {
        children: childrenEntriesValues.map((c) => c.entry),
      },
      values: {
        children: childrenEntriesValues.map((c) => c.value),
      },
      watchTriggers: collectedTriggers,
      footBadges: collectedFootBadges,
    };
  },
};

export default cmd;
