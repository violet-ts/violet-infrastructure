import { Temporal } from '@js-temporal/polyfill';
import { constructFullCommentBody, findCmdByName, runMain } from '@self/bot/src/app/cmd';
import type { CmdStatus, ReplyCmd } from '@self/bot/src/type/cmd';
import { cmdStatusSchema } from '@self/bot/src/type/cmd';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { emojiStatus, unmarshallMetaArgs } from './util';

const entrySchema = z.object({
  children: z.array(
    z.object({
      name: z.string(),
      boundArgs: z.array(z.string()),
      entry: z.any(),
      status: cmdStatusSchema,
      lastComment: z.string(),
      startTime: z.number(),
      endTime: z.optional(z.number()),
    }),
  ),
});
export type Entry = z.infer<typeof entrySchema>;

export interface CommentValues {
  childValues: Array<
    | {
        values: unknown;
      }
    | {
        comment: string;
      }
  >;
}

export const argSchema = {} as const;
export type ArgSchema = typeof argSchema;

const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
  name: 'prallel',
  hidden: true,
  description: '',
  entrySchema,
  argSchema,
  async main(ctx, args, generalEntry) {
    const collectedArns = new Set<string>();
    const boundCmds = unmarshallMetaArgs(args._);
    const statusCount = {
      undone: 0,
      success: 0,
      failure: 0,
    };
    const childrenEntriesValues = await Promise.all(
      boundCmds.map(async (child) => {
        const startTime = Temporal.Now.instant().epochMilliseconds;
        let endTime: number | undefined;
        const uuid = uuidv4();
        const { entry, status, values, comment } = await runMain(
          child.cmd,
          ctx,
          child.boundArgs,
          {
            ...generalEntry,
            uuid,
          },
          ({ watchArns }) => {
            if (watchArns) {
              [...watchArns].forEach((arn) => collectedArns.add(arn));
              watchArns.clear();
            }
          },
        );
        statusCount[status] += 1;
        if (status !== 'undone') endTime = Temporal.Now.instant().epochMilliseconds;
        return {
          entry: {
            name: child.cmd.name,
            boundArgs: child.boundArgs,
            entry,
            status,
            lastComment: comment,
            startTime,
            endTime,
          },
          values: { values },
        };
      }),
    );
    const children = childrenEntriesValues.map((c) => c.entry);
    const childValues = childrenEntriesValues.map((c) => c.values);
    const status = ((): CmdStatus => {
      if (statusCount.failure) return 'failure';
      if (statusCount.undone) return 'undone';
      return 'success';
    })();

    return {
      status,
      entry: {
        children,
      },
      values: {
        childValues,
      },
      watchArns: collectedArns,
    };
  },
  constructComment(entry, values, ctx) {
    return {
      main: [],
      hints: entry.children.map((child, i) => {
        const childValues = values.childValues[i];
        return {
          title: `${emojiStatus(child.status)} ${child.name}`,
          body:
            'values' in childValues
              ? constructFullCommentBody(findCmdByName(child.name), child.entry, childValues.values, ctx)
              : { main: [childValues.comment] },
        };
      }),
    };
  },
  async update(entry, ctx) {
    const statusCount = {
      undone: 0,
      success: 0,
      failure: 0,
    };
    const childrenEntriesValues = await Promise.all(
      entry.children.map(
        async (child): Promise<{ entry: Entry['children'][number]; values: CommentValues['childValues'][number] }> => {
          const cmd = findCmdByName(child.name);
          if (cmd.update) {
            const { entry, status, values } = await cmd.update(child.entry, ctx);
            statusCount[status] += 1;
            return {
              entry: {
                ...child,
                entry,
              },
              values: {
                values,
              },
            };
          }
          statusCount[child.status] += 1;
          return { entry: child, values: { comment: child.lastComment } };
        },
      ),
    );
    const children = childrenEntriesValues.map((c) => c.entry);
    const childValues = childrenEntriesValues;
    const status = ((): CmdStatus => {
      if (statusCount.failure) return 'failure';
      if (statusCount.undone) return 'undone';
      return 'success';
    })();
    return {
      status,
      entry: { children },
      values: { childValues },
    };
  },
};

export default cmd;
