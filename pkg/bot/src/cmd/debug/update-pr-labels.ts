import type { Temporal } from '@js-temporal/polyfill';
import { toTemporalInstant } from '@js-temporal/polyfill';
import { getBuild, startBuild } from '@self/bot/src/cmd/template/codebuild';
import type { ReplyCmd } from '@self/bot/src/type/cmd';
import { renderAnchor, renderTimestamp } from '@self/bot/src/util/comment-render';
import { dynamicRunScriptCodeBuildEnv } from '@self/shared/lib/run-script/env';
import { dynamicUpdatePrLabelsEnvCodeBuildEnv } from '@self/shared/lib/update-pr-labels/env';
import { z } from 'zod';

const entrySchema = z.object({
  prNumber: z.number(),
  buildId: z.string(),
  buildArn: z.string(),
});
export type Entry = z.infer<typeof entrySchema>;

interface CommentValues {
  buildStatus: string;
  statusChangedAt: Temporal.Instant;
  deepLogLink?: string | null;
  timeRange?: string | null;
}

export const argSchema = {} as const;
export type ArgSchema = typeof argSchema;

const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
  name: 'upla',
  description: '',
  hidden: true,
  entrySchema,
  argSchema,
  async main(ctx, _args, generalEntry) {
    const { number: prNumber } = ctx.commentPayload.issue;
    const { credentials, logger } = ctx;

    const r = await startBuild({
      input: {
        projectName: ctx.env.PR_UPDATE_LABELS_PROJECT_NAME,
        environmentVariablesOverride: [
          ...dynamicRunScriptCodeBuildEnv({
            ENTRY_UUID: generalEntry.uuid,
          }),
          ...dynamicUpdatePrLabelsEnvCodeBuildEnv({
            UPDATE_LABELS_OWNER: ctx.commentPayload.repository.owner.login,
            UPDATE_LABELS_REPO: ctx.commentPayload.repository.name,
            UPDATE_LABELS_PR_NUMBER: prNumber.toString(),
            BOT_INSTALLATION_ID: z.number().parse(ctx.commentPayload.installation?.id).toString(),
          }),
        ],
      },
      credentials,
      logger,
    });

    const entry: Entry = {
      prNumber,
      buildId: r.build.id,
      buildArn: r.build.arn,
    };

    const values: CommentValues = {
      buildStatus: r.build.buildStatus,
      statusChangedAt: toTemporalInstant.call(r.build.startTime),
    };

    return {
      status: 'undone',
      entry,
      values,
    };
  },
  constructComment(entry, values, ctx) {
    // TODO(hardcoded)
    const region = 'ap-northeast-1';
    const buildUrl = `https://${region}.console.aws.amazon.com/codesuite/codebuild/projects/${
      ctx.env.PR_UPDATE_LABELS_PROJECT_NAME
    }/build/${encodeURIComponent(entry.buildId)}/?region=${region}`;
    const { timeRange } = values;
    return {
      mode: 'ul',
      main: [
        `ビルドステータス: ${values.buildStatus} (${renderTimestamp(values.statusChangedAt)})`,
        timeRange && `ビルド時間: ${timeRange}`,
      ],
      hints: [
        {
          title: '詳細',
          body: {
            mode: 'ul',
            main: [
              `ビルドID: ${renderAnchor(entry.buildId, buildUrl)}`,
              values.deepLogLink && renderAnchor('ビルドの詳細ログ (CloudWatch Logs)', values.deepLogLink),
            ],
          },
        },
      ],
    };
  },
  async update(entry, ctx) {
    const { credentials, logger } = ctx;
    const { last, statusChangedAt, status, timeRange } = await getBuild({
      buildId: entry.buildId,
      credentials,
      logger,
    });

    const values: CommentValues = {
      buildStatus: last.buildStatus,
      statusChangedAt,
      deepLogLink: last.logs?.deepLink,
      timeRange,
    };

    return {
      status,
      values,
    };
  },
};

export default cmd;
