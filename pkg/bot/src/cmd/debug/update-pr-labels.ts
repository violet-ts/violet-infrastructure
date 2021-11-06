import { CodeBuild } from '@aws-sdk/client-codebuild';
import type { Temporal } from '@js-temporal/polyfill';
import { toTemporalInstant } from '@js-temporal/polyfill';
import type { ReplyCmd } from '@self/bot/src/type/cmd';
import { renderDuration, renderTimestamp } from '@self/bot/src/util/comment-render';
import type { BuiltInfo } from '@self/shared/lib/operate-env/build-output';
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
  builtInfo?: BuiltInfo | null;
}

const cmd: ReplyCmd<Entry, CommentValues> = {
  name: 'upd-pr',
  where: 'pr',
  description: '',
  hidden: true,
  entrySchema,
  async main(ctx, _args, generalEntry) {
    const { number: prNumber } = ctx.commentPayload.issue;
    const { credentials, logger } = ctx;

    const codeBuild = new CodeBuild({ credentials, logger });
    const r = await codeBuild.startBuild({
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
    });

    const { build } = r;
    if (build == null) throw new TypeError('Response not found for CodeBuild.startBuild');
    if (typeof build.buildStatus !== 'string') throw new TypeError('CodeBuild response buildStatus is not string');
    if (typeof build.id !== 'string') throw new TypeError('CodeBuild response id is not string');
    if (typeof build.arn !== 'string') throw new TypeError('CodeBuild response arn is not string');
    if (build.startTime == null) throw new TypeError('CodeBuild response startTime is not Date');

    const entry: Entry = {
      prNumber,
      buildId: build.id,
      buildArn: build.arn,
    };

    const values: CommentValues = {
      buildStatus: build.buildStatus,
      statusChangedAt: toTemporalInstant.call(build.startTime),
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
    const { builtInfo } = values;
    return {
      main: [
        `- ビルドID: [${entry.buildId}](${buildUrl})`,
        `- ビルドステータス: ${values.buildStatus} (${renderTimestamp(values.statusChangedAt)})`,
        builtInfo && `- ビルド時間: ${builtInfo.timeRange}`,
        values.deepLogLink && `- [ビルドの詳細ログ (CloudWatch Logs)](${values.deepLogLink})`,
      ],
    };
  },
  async update(entry, ctx) {
    const { credentials, logger } = ctx;
    const codeBuild = new CodeBuild({ credentials, logger });
    const r = await codeBuild.batchGetBuilds({
      ids: [entry.buildId],
    });
    const { builds } = r;
    ctx.logger.info('builds', { builds });
    if (builds == null) throw new TypeError('builds not found');
    const first = builds[0];
    const last = builds[builds.length - 1];
    if (typeof last.buildStatus !== 'string') throw new TypeError('CodeBuild last buildStatus is not string');
    const firstStartTime = first.startTime;
    const lastStartTime = last.startTime;
    const lastEndTime = last.endTime;
    if (firstStartTime == null) throw new TypeError('CodeBuild first startTime is not found');
    if (lastStartTime == null) throw new TypeError('CodeBuild last startTime is not found');

    const computeBuiltInfo = async (): Promise<BuiltInfo | null> => {
      const timeRange = renderDuration(
        toTemporalInstant.call(firstStartTime).until(toTemporalInstant.call(lastEndTime ?? lastStartTime)),
      );

      return {
        timeRange,
      };
    };

    ctx.logger.info('Get last status.', { buildStatus: last.buildStatus });
    const builtInfo = last.buildStatus === 'SUCCEEDED' ? await computeBuiltInfo() : null;
    ctx.logger.info('Built info.', { builtInfo });

    const values: CommentValues = {
      buildStatus: last.buildStatus,
      statusChangedAt: toTemporalInstant.call(lastEndTime ?? lastStartTime),
      deepLogLink: last.logs?.deepLink,
      builtInfo,
    };

    return {
      status: ({ SUCCEEDED: 'success', FAILED: 'failure' } as const)[last.buildStatus] ?? 'undone',
      entry,
      values,
    };
  },
};

export default cmd;
