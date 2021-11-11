import { findCmdByName } from '@self/bot/src/app/cmd';
import { reEvaluateAndUpdate } from '@self/bot/src/app/update-cmd';
import type { ReplyCmd } from '@self/bot/src/type/cmd';
import { generalEntrySchema } from '@self/bot/src/type/cmd';
import { getEntryByUUID } from '@self/bot/src/util/aws/comment-db';
import { z } from 'zod';
import type { DoneChild } from './util';
import {
  constructDoneChild,
  createStatusCounter,
  createTriggerCollector,
  doneChildSchema,
  emojiStatus,
  processingChildSchema,
  runMainWrapper,
  unmarshallMetaArgs,
  waitChildSchema,
} from './util';

const entrySchema = z.object({
  namespace: z.string(),
  // TODO: dirty
  commentPayload: z.any(),
  doneChildren: z.array(doneChildSchema),
  processingChild: processingChildSchema.nullable(),
  waitChildren: z.array(waitChildSchema),
});
export type Entry = z.infer<typeof entrySchema>;

export interface CommentValues {
  processingInDoneForm: DoneChild | null;
}

export const argSchema = {} as const;
export type ArgSchema = typeof argSchema;

/* eslint-disable no-restricted-syntax,no-await-in-loop */
const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
  name: 'serial',
  hidden: true,
  description: '',
  entrySchema,
  argSchema,
  async main(ctx, args, rootGeneralEntry) {
    const { collectedTriggers, touchResult } = createTriggerCollector();
    const boundCmds = unmarshallMetaArgs(args._);
    const { add, summary, get } = createStatusCounter();
    const doneChildren: Entry['doneChildren'] = [];
    let processingChild: Entry['processingChild'] = null;
    const waitChildren: Entry['waitChildren'] = [];
    let processingInDoneForm: CommentValues['processingInDoneForm'] = null;
    for (const boundCmd of boundCmds) {
      if (get('undone') || get('failure')) {
        add('wait');
        waitChildren.push({
          name: boundCmd.cmd.name,
          boundArgs: boundCmd.boundArgs,
        });
      } else {
        const { done, processing, status } = await runMainWrapper({
          ctx,
          add,
          boundCmd,
          rootGeneralEntry,
          touchResult,
        });
        if (status === 'undone') {
          processingChild = processing;
          processingInDoneForm = done;
        } else {
          doneChildren.push(done);
        }
      }
    }

    return {
      status: summary(),
      entry: {
        namespace: ctx.namespace,
        commentPayload: ctx.commentPayload,
        doneChildren,
        processingChild,
        waitChildren,
      },
      values: {
        processingInDoneForm,
      },
      watchTriggers: collectedTriggers,
    };
  },
  constructComment(rootEntry, values, _ctx) {
    return {
      main: [],
      mode: 'ul',
      hints: [
        ...[...rootEntry.doneChildren, ...(values.processingInDoneForm ? [values.processingInDoneForm] : [])].map(
          constructDoneChild,
        ),
        ...rootEntry.waitChildren.map((child) => {
          return {
            title: `${emojiStatus(undefined)} ${child.name}`,
            body: { main: ['...'] },
          };
        }),
      ],
    };
  },
  async update(rootEntry, ctx) {
    const rootGeneralEntry = generalEntrySchema.parse(rootEntry);
    const { collectedTriggers, touchResult } = createTriggerCollector();
    const { add, summary, get } = createStatusCounter();
    const doneChildren = [...rootEntry.doneChildren];
    let processingChild: Entry['processingChild'] = null;
    const waitChildren: Entry['waitChildren'] = [];
    let processingInDoneForm: CommentValues['processingInDoneForm'] = null;
    doneChildren.forEach((c) => {
      add(c.status);
    });
    const undoneChildren = [
      ...(rootEntry.processingChild ? [rootEntry.processingChild] : []),
      ...rootEntry.waitChildren,
    ] as const;
    for (const child of undoneChildren) {
      if (get('undone') || get('failure')) {
        add('wait');
        waitChildren.push({
          name: child.name,
          boundArgs: child.boundArgs,
        });
      } else {
        const cmd = findCmdByName(child.name);
        if ('entryUUID' in child) {
          const oldEntry = await getEntryByUUID({
            ...ctx,
            uuid: child.entryUUID,
          });
          const { status, newEntry, fullComment } = await reEvaluateAndUpdate(
            oldEntry,
            ctx.env,
            ctx.octokit,
            ctx.credentials,
            ctx.logger,
            false,
            touchResult,
          );

          add(status);
          const done = {
            name: child.name,
            boundArgs: child.boundArgs,
            startedAt: newEntry.startedAt,
            updatedAt: newEntry.updatedAt,
            status,
            lastComment: fullComment,
          };
          if (status === 'undone') {
            processingInDoneForm = done;
            processingChild = {
              ...child,
              status,
            };
          } else {
            doneChildren.push(done);
          }
        } else {
          const { done, processing, status } = await runMainWrapper({
            ctx: {
              ...ctx,
              namespace: rootEntry.namespace,
              commentPayload: rootEntry.commentPayload,
            },
            add,
            boundCmd: {
              cmd,
              boundArgs: child.boundArgs,
            },
            rootGeneralEntry,
            touchResult,
          });
          if (status === 'undone') {
            processingInDoneForm = done;
            processingChild = processing;
          } else {
            doneChildren.push(done);
          }
        }
      }
    }

    return {
      status: summary(),
      updateEntry: {
        doneChildren,
        processingChild,
        waitChildren,
      },
      values: {
        processingInDoneForm,
      },
      watchTriggers: collectedTriggers,
    };
  },
};
/* eslint-enable no-restricted-syntax,no-await-in-loop */

export default cmd;
