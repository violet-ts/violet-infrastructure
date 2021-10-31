import { CodeBuild } from 'aws-sdk';
import type { Temporal } from '@js-temporal/polyfill';
import { toTemporalInstant } from '@js-temporal/polyfill';
import { z } from 'zod';
import { dynamicOpCodeBuildEnv, scriptOpCodeBuildEnv } from '@self/shared/lib/operate-env/op-env';
import type { BuiltInfo } from '@self/shared/lib/operate-env/built-info';
import { outputBuiltInfoSchema } from '@self/shared/lib/operate-env/built-info';
import type { ReplyCmd } from '../type/cmd';
import { renderDuration, renderTimestamp } from '../util/comment-render';
import { collectLogsOutput } from '../util/aws/logs-output';
import { renderECRImageDigest } from '../util/comment-render/aws';
import { getImageDetailByTag } from '../util/aws/ecr';
import { renderGitHubCommit } from '../util/comment-render/github';

// TODO(hardcoded)
const imageRegion = 'ap-northeast-1';

const entrySchema = z.object({
  prNumber: z.number(),
  buildId: z.string(),
  buildArn: z.string(),
  apiImageDigest: z.string(),
});
export type Entry = z.infer<typeof entrySchema>;

export interface CommentValues {
  buildStatus: string;
  statusChangedAt: Temporal.Instant;
  deepLogLink?: string | null;
  builtInfo?: BuiltInfo | null;
}

const cmd: ReplyCmd<Entry, CommentValues> = {
  name: 'preview/start',
  where: 'pr',
  description: '先に /build が必要。',
  hidden: false,
  entrySchema,
  async main(ctx, _args) {
    const { number: prNumber } = ctx.commentPayload.issue;

    const apiImageDetail = await getImageDetailByTag({
      imageRegion,
      imageRepoName: ctx.env.API_REPO_NAME,
      imageTag: ctx.namespace,
    });
    if (!apiImageDetail) throw new Error('Image for API not found.');

    const codeBuild = new CodeBuild();
    const r = await codeBuild
      .startBuild({
        projectName: ctx.env.API_BUILD_PROJECT_NAME,
        environmentVariablesOverride: [
          ...scriptOpCodeBuildEnv({
            OPERATION: 'deploy',
          }),
          ...dynamicOpCodeBuildEnv({
            NAMESPACE: ctx.namespace,
            API_REPO_SHA: apiImageDetail.imageDigest,
          }),
        ],
      })
      .promise();

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
      apiImageDigest: apiImageDetail.imageDigest,
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
      ctx.env.OPERATE_ENV_PROJECT_NAME
    }/build/${encodeURIComponent(entry.buildId)}/?region=${region}`;
    const { builtInfo } = values;
    return {
      main: [
        `- ビルドID: [${entry.buildId}](${buildUrl})`,
        `- ビルドステータス: ${values.buildStatus} (${renderTimestamp(values.statusChangedAt)})`,
        builtInfo &&
          `- 使用した API イメージダイジェスト: ${renderECRImageDigest({
            imageRegion,
            imageDigest: entry.apiImageDigest,
            imageRepoName: ctx.env.API_REPO_NAME,
          })}`,
        builtInfo && `- ビルド時間: ${builtInfo.timeRange}`,
        values.deepLogLink && `- [ビルドの詳細ログ (CloudWatch Logs)](${values.deepLogLink})`,
      ],
      hints: [
        {
          title: '詳細',
          body: {
            main: [
              builtInfo &&
                `- 使用したインフラ定義バージョン: ${renderGitHubCommit({
                  owner: 'violet-ts',
                  repo: 'violet-infrastructure',
                  rev: builtInfo.rev,
                })}`,
            ],
          },
        },
      ],
    };
  },
  async update(entry, ctx) {
    const codeBuild = new CodeBuild();
    const r = await codeBuild
      .batchGetBuilds({
        ids: [entry.buildId],
      })
      .promise();
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
      ctx.logger.info('checking cloudwatch logs', { logs: last.logs });
      const { logs } = last;
      if (logs == null) return null;
      if (logs.groupName == null) return null;
      if (logs.streamName == null) return null;
      const p = await collectLogsOutput(logs.groupName, [logs.streamName]);
      const timeRange = renderDuration(
        toTemporalInstant.call(firstStartTime).until(toTemporalInstant.call(lastEndTime ?? lastStartTime)),
      );

      return {
        ...outputBuiltInfoSchema.parse({
          ...p,
        }),
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
