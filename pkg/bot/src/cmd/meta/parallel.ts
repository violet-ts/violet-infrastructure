import { Temporal } from '@js-temporal/polyfill';
import { constructFullCommentBody, findCmdByName, runMain } from '@self/bot/src/app/cmd';
import type { CmdStatus, CommentValuesForTypeCheck, ReplyCmd } from '@self/bot/src/type/cmd';
import { cmdStatusSchema } from '@self/bot/src/type/cmd';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { reEvaluateCommentEntry } from '@self/bot/src/app/update-cmd';
import { emojiStatus, unmarshallMetaArgs } from './util';

const entrySchema = z.object({
  children: z.array(
    z.object({
      name: z.string(),
      boundArgs: z.array(z.string()),
      entry: z.any(),
      status: cmdStatusSchema,
      lastComment: z.string(),
    }),
  ),
});
export type Entry = z.infer<typeof entrySchema>;

export interface CommentValues {
  childValues: Array<
    | {
        values: CommentValuesForTypeCheck;
      }
    | {
        comment: string;
      }
  >;
}

export const argSchema = {} as const;
export type ArgSchema = typeof argSchema;

const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
  name: 'parallel',
  hidden: true,
  description: '',
  entrySchema,
  argSchema,
  async main(ctx, args, generalEntry) {
    const collectedArns = new Set<string>();
    const touchResult = ({ watchArns }: { watchArns?: Set<string> | null | undefined }) => {
      if (watchArns) {
        [...watchArns].forEach((arn) => collectedArns.add(arn));
        watchArns.clear();
      }
    };
    const boundCmds = unmarshallMetaArgs(args._);
    const statusCount = {
      undone: 0,
      success: 0,
      failure: 0,
    };
    const childrenEntriesValues = await Promise.all(
      boundCmds.map(async (boundCmd) => {
        const startedAt = Temporal.Now.instant().epochMilliseconds;
        const uuid = uuidv4();
        const { entry, status, values, comment } = await runMain(
          boundCmd.cmd,
          ctx,
          boundCmd.boundArgs,
          {
            ...generalEntry,
            name: boundCmd.cmd.name,
            uuid,
            startedAt,
            updatedAt: startedAt,
          },
          false,
          touchResult,
        );
        statusCount[status] += 1;
        return {
          entry: {
            name: boundCmd.cmd.name,
            boundArgs: boundCmd.boundArgs,
            entry,
            status,
            lastComment: comment,
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
      mode: 'ul',
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
    const collectedArns = new Set<string>();
    const touchResult = ({ watchArns }: { watchArns?: Set<string> | null | undefined }) => {
      if (watchArns) {
        [...watchArns].forEach((arn) => collectedArns.add(arn));
        watchArns.clear();
      }
    };
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
            const { status, newEntry, fullComment, values } = await reEvaluateCommentEntry(
              child.entry,
              ctx.env,
              ctx.octokit,
              ctx.credentials,
              ctx.logger,
              touchResult,
            );

            statusCount[status] += 1;
            return {
              entry: {
                ...child,
                entry: newEntry,
                lastComment: fullComment,
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
    const childValues = childrenEntriesValues.map((c) => c.values);
    const status = ((): CmdStatus => {
      if (statusCount.failure) return 'failure';
      if (statusCount.undone) return 'undone';
      return 'success';
    })();
    return {
      status,
      entry: { children },
      values: { childValues },
      watchArns: collectedArns,
    };
  },
};

export default cmd;
