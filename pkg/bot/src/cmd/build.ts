import { CodeBuild } from 'aws-sdk';
import type { Temporal } from '@js-temporal/polyfill';
import { toTemporalInstant } from '@js-temporal/polyfill';
import { z } from 'zod';
import type { ReplyCmd } from '../type/cmd';
import { renderTimestamp, renderDuration } from '../util/comment-render';
import { setupAws } from '../util/hint';
import { collectLogsOutput } from '../util/logs-output';

const entrySchema = z.object({
  prNumber: z.number(),
  buildId: z.string(),
  buildArn: z.string(),
});
export type Entry = z.infer<typeof entrySchema>;

const builtInfoSchema = z.object({
  rev: z.string(),
  imageSize: z.string(),
  imageDigest: z.string(),
  imageTag: z.string(),
  imageRepoName: z.string(),
  timeRange: z.string(),
});
export type BuiltInfo = z.infer<typeof builtInfoSchema>;

export interface CommentValues {
  buildStatus: string;
  statusChangedAt: Temporal.Instant;
  deepLogLink?: string | null;
  builtInfo?: BuiltInfo | null;
}

const cmd: ReplyCmd<Entry, CommentValues> = {
  name: 'build',
  where: 'pr',
  description: 'build',
  hidden: false,
  entrySchema,
  async main(ctx, _args) {
    const { number: prNumber } = ctx.commentPayload.issue;
    const codeBuild = new CodeBuild();
    const r = await codeBuild
      .startBuild({
        projectName: ctx.env.API_BUILD_PROJECT_NAME,
        environmentVariablesOverride: [
          {
            name: 'GIT_URL',
            // TODO(hardcoded)
            value: 'https://github.com/LumaKernel/violet.git',
          },
          {
            name: 'GIT_FETCH',
            value: `refs/pull/${prNumber}/head`,
          },
          {
            name: 'IMAGE_TAG',
            value: `pr${prNumber}`,
          },
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
    };

    const values: CommentValues = {
      buildStatus: build.buildStatus,
      statusChangedAt: toTemporalInstant.call(build.startTime),
    };

    return {
      save: true,
      entry,
      values,
    };
  },
  constructComment(entry, values, ctx) {
    // TODO(hardcoded)
    const region = 'ap-northeast-1';
    const buildUrl = `https://${region}.console.aws.amazon.com/codesuite/codebuild/projects/${
      ctx.env.API_BUILD_PROJECT_NAME
    }/build/${encodeURIComponent(entry.buildId)}/?region=${region}`;
    const { builtInfo } = values;
    return {
      main: [
        `- ビルドID: [${entry.buildId}](${buildUrl})`,
        `- ビルドステータス: ${values.buildStatus} (${renderTimestamp(values.statusChangedAt)})`,
        builtInfo != null && `- イメージタグ: \`${builtInfo.imageTag}\``,
        builtInfo != null && `- イメージダイジェスト: \`${builtInfo.imageDigest}\``,
        builtInfo != null && `- イメージサイズ: ${builtInfo.imageSize}`,
        builtInfo != null &&
          `- 使用コミット: [${builtInfo.rev.slice(0, 6)}](https://github.com/LumaKernel/violet/pull/${
            entry.prNumber
          }/commits/${builtInfo.rev})`,
        builtInfo != null && `- ビルド時間: ${builtInfo.timeRange}`,
        values.deepLogLink != null && `- [ビルドの詳細ログ (CloudWatch)](${values.deepLogLink})`,
      ],
      hints: [
        builtInfo != null && {
          title: 'Docker イメージの取得方法',
          body: {
            main: [
              '```bash',
              ...setupAws,
              `aws ecr get-login-password --profile "$AWS_PROFILE" --region ${region} | docker login --username AWS --password-stdin "https://\${AWS_ACCOUNT_ID}.dkr.ecr.${region}.amazonaws.com"`,
              `docker pull "\${AWS_ACCOUNT_ID}.dkr.ecr.${region}.amazonaws.com/${builtInfo.imageRepoName}:${builtInfo.imageDigest}"`,
              '```',
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
      return builtInfoSchema.parse({
        ...p,
        timeRange,
      });
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
      entry,
      values,
    };
  },
};

export default cmd;
