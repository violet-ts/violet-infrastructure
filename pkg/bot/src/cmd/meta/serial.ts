import { Temporal } from '@js-temporal/polyfill';
import { constructFullCommentBody, findCmdByName, runMain } from '@self/bot/src/app/cmd';
import type { CmdStatus, CommentValuesForTypeCheck, ReplyCmd } from '@self/bot/src/type/cmd';
import { cmdStatusSchema } from '@self/bot/src/type/cmd';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { reEvaluateCommentEntry } from '@self/bot/src/app/update-cmd';
import { emojiStatus, unmarshallMetaArgs } from './util';

const entrySchema = z.object({
  namespace: z.string(),
  // TODO: dirty
  commentPayload: z.any(),
  startedChildren: z.array(
    z.object({
      name: z.string(),
      boundArgs: z.array(z.string()),
      entry: z.any(),
      status: cmdStatusSchema,
      lastComment: z.string(),
    }),
  ),
  waitChildlen: z.array(
    z.object({
      name: z.string(),
      boundArgs: z.array(z.string()),
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

/* eslint-disable no-restricted-syntax,no-await-in-loop */
const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
  name: 'serial',
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
      wait: 0,
    };
    const startedChildren: Entry['startedChildren'] = [];
    const waitChildlen: Entry['waitChildlen'] = [];
    const childValues: CommentValues['childValues'] = [];
    for (const boundCmd of boundCmds) {
      if (statusCount.undone || statusCount.failure) {
        statusCount.wait += 1;
        waitChildlen.push({
          name: boundCmd.cmd.name,
          boundArgs: boundCmd.boundArgs,
        });
      } else {
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
          ({ watchArns }) => {
            if (watchArns) {
              [...watchArns].forEach((arn) => collectedArns.add(arn));
              watchArns.clear();
            }
          },
        );
        statusCount[status] += 1;
        startedChildren.push({
          name: boundCmd.cmd.name,
          boundArgs: boundCmd.boundArgs,
          entry,
          status,
          lastComment: comment,
        });
        childValues.push({ values });
      }
    }
    const status = ((): CmdStatus => {
      if (statusCount.failure) return 'failure';
      if (statusCount.undone) return 'undone';
      if (statusCount.wait) return 'undone';
      return 'success';
    })();

    return {
      status,
      entry: {
        namespace: ctx.namespace,
        commentPayload: ctx.commentPayload,
        startedChildren,
        waitChildlen,
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
      hints: [
        ...entry.startedChildren.map((child, i) => {
          const childValues = values.childValues[i];
          return {
            title: `${emojiStatus(child.status)} ${child.name}`,
            body:
              'values' in childValues
                ? constructFullCommentBody(findCmdByName(child.name), child.entry, childValues.values, ctx)
                : { main: [childValues.comment] },
          };
        }),
        ...entry.waitChildlen.map((child) => {
          return {
            title: `${emojiStatus(undefined)} ${child.name}`,
            body: { main: ['...'] },
          };
        }),
      ],
    };
  },
  async update(rootEntry, ctx) {
    const collectedArns = new Set<string>([...(rootEntry.watchArns ?? [])]);
    const statusCount = {
      undone: 0,
      success: 0,
      failure: 0,
      wait: 0,
    };
    const startedChildren: Entry['startedChildren'] = rootEntry.startedChildren.filter((c) => c.status !== 'undone');
    const waitChildlen: Entry['waitChildlen'] = [];
    const childValues: CommentValues['childValues'] = [];
    const touchResult = ({ watchArns }: { watchArns?: Set<string> | null | undefined }) => {
      if (watchArns) {
        [...watchArns].forEach((arn) => collectedArns.add(arn));
        watchArns.clear();
      }
    };
    startedChildren.forEach((c) => {
      statusCount[c.status] += 1;
    });
    const undoneChildren = rootEntry.startedChildren.filter((c) => c.status === 'undone');
    for (const child of [...undoneChildren]) {
      if (statusCount.undone || statusCount.failure) {
        statusCount.wait += 1;
        waitChildlen.push({
          name: child.name,
          boundArgs: child.boundArgs,
        });
      } else {
        const cmd = findCmdByName(child.name);
        if ('entry' in child) {
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
            startedChildren.push({
              ...child,
              entry: newEntry,
              lastComment: fullComment,
            });
            childValues.push({
              values,
            });
          } else {
            statusCount[child.status] += 1;
            startedChildren.push(child);
            childValues.push({
              comment: child.lastComment,
            });
          }
        } else {
          const uuid = uuidv4();
          const startedAt = Temporal.Now.instant().epochMilliseconds;
          const { entry, status, values, comment } = await runMain(
            cmd,
            {
              ...ctx,
              namespace: rootEntry.namespace,
              commentPayload: rootEntry.commentPayload,
            },
            child.boundArgs,
            {
              ...rootEntry,
              uuid,
              startedAt,
              updatedAt: startedAt,
            },
            false,
            touchResult,
          );
          statusCount[status] += 1;
          startedChildren.push({
            name: cmd.name,
            boundArgs: child.boundArgs,
            entry,
            status,
            lastComment: comment,
          });
          childValues.push({ values });
        }
      }
    }
    const status = ((): CmdStatus => {
      if (statusCount.failure) return 'failure';
      if (statusCount.undone) return 'undone';
      if (statusCount.wait) return 'undone';
      return 'success';
    })();

    return {
      status,
      entry: {
        startedChildren,
        waitChildlen,
      },
      values: {
        childValues,
      },
      watchArns: collectedArns,
    };
  },
};
/* eslint-enable no-restricted-syntax,no-await-in-loop */

export default cmd;
