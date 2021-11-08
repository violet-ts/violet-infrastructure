import { CodeBuild } from '@aws-sdk/client-codebuild';
import type { Temporal } from '@js-temporal/polyfill';
import { toTemporalInstant } from '@js-temporal/polyfill';
import { z } from 'zod';
import { dynamicBuildCodeBuildEnv } from '@self/shared/lib/build-env';
import type { ReplyCmd, ReplyCmdStatic } from '@self/bot/src/type/cmd';
import type { AccumuratedBotEnv } from '@self/shared/lib/bot/env';
import { renderTimestamp, renderDuration, renderBytes } from '@self/bot/src/util/comment-render';
import { renderECRImageDigest } from '@self/bot/src/util/comment-render/aws';
import { hintHowToPullDocker } from '@self/bot/src/util/hint';
import { collectLogsOutput } from '@self/bot/src/util/aws/logs-output';
import { getImageDetailByTag } from '@self/bot/src/util/aws/ecr';
import { renderGitHubPRCommit } from '@self/bot/src/util/comment-render/github';

// TODO(hardcoded)
const imageRegion = 'ap-northeast-1';

const entrySchema = z.object({
  prNumber: z.number(),
  buildId: z.string(),
  imageTag: z.string(),
  imageRepoName: z.string(),
});
export type Entry = z.infer<typeof entrySchema>;

const outputBuiltInfoSchema = z.object({
  rev: z.string(),
});
export type OutputBuiltInfo = z.infer<typeof outputBuiltInfoSchema>;

export type BuiltInfo = OutputBuiltInfo & {
  timeRange: string;
};

const imageDetailSchema = z.object({
  imageRegion: z.string(),
  imageRepoName: z.string(),
  imageDigest: z.string(),
  imageSizeInBytes: z.number(),
});
export type ImageDetail = z.infer<typeof imageDetailSchema>;

export interface CommentValues {
  buildStatus: string;
  statusChangedAt: Temporal.Instant;
  deepLogLink?: string | null;
  builtInfo?: BuiltInfo | null;
  imageDetail?: ImageDetail | null;
}

interface CreateParams {
  imageRepoName: string;
  buildDockerfile: string;
  projectName: string;
  dockerBuildArgs: string;
}

export const argSchema = {} as const;
export type ArgSchema = typeof argSchema;

const createCmd = (
  st: ReplyCmdStatic,
  paramsGetter: (env: AccumuratedBotEnv, namespace: string) => CreateParams,
): ReplyCmd<Entry, CommentValues, ArgSchema> => {
  const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
    ...st,
    entrySchema,
    argSchema,
    async main(ctx, _args) {
      const { number: prNumber } = ctx.commentPayload.issue;
      const { credentials, logger } = ctx;
      const codeBuild = new CodeBuild({ credentials, logger });
      const imageTag = ctx.namespace;
      const params = paramsGetter(ctx.env, ctx.namespace);
      const r = await codeBuild.startBuild({
        projectName: params.projectName,
        environmentVariablesOverride: [
          ...dynamicBuildCodeBuildEnv({
            GIT_URL: ctx.commentPayload.repository.clone_url,
            GIT_FETCH: `refs/pull/${prNumber}/head`,
            IMAGE_REPO_NAME: params.imageRepoName,
            IMAGE_TAG: imageTag,
            BUILD_DOCKERFILE: params.buildDockerfile,
            DOCKER_BUILD_ARGS: params.dockerBuildArgs,
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
        imageTag,
        imageRepoName: params.imageRepoName,
      };

      const values: CommentValues = {
        buildStatus: build.buildStatus,
        statusChangedAt: toTemporalInstant.call(build.startTime),
      };

      return {
        status: 'undone',
        entry,
        values,
        watchArns: new Set(build.arn),
      };
    },
    constructComment(entry, values, ctx) {
      const params = paramsGetter(ctx.env, entry.namespace);
      const { builtInfo, imageDetail } = values;
      const buildUrl = `https://${imageRegion}.console.aws.amazon.com/codesuite/codebuild/projects/${
        params.projectName
      }/build/${encodeURIComponent(entry.buildId)}/`;
      return {
        main: [
          `- ビルドステータス: ${values.buildStatus} (${renderTimestamp(values.statusChangedAt)})`,
          imageDetail && `- イメージサイズ: ${renderBytes(imageDetail.imageSizeInBytes)}`,
          builtInfo &&
            `- 使用コミット: ${renderGitHubPRCommit({
              rev: builtInfo.rev,
              prNumber: entry.prNumber,
              owner: entry.commentOwner,
              repo: entry.commentRepo,
            })}`,
          builtInfo && `- ビルド時間: ${builtInfo.timeRange}`,
        ],
        hints: [
          {
            title: '詳細',
            body: {
              main: [
                builtInfo &&
                  imageDetail &&
                  `- イメージダイジェスト: ${renderECRImageDigest({ ...imageDetail, ...builtInfo })}`,
                `- ビルドID: [${entry.buildId}](${buildUrl})`,
                values.deepLogLink && `- [ビルドの詳細ログ (CloudWatch Logs)](${values.deepLogLink})`,
              ],
            },
          },
          builtInfo &&
            imageDetail && {
              title: 'Docker イメージの取得方法',
              body: hintHowToPullDocker({
                ...imageDetail,
              }),
            },
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
        ctx.logger.info('Checking cloudwatch logs.', { logs: last.logs });
        const { logs } = last;
        if (logs == null) return null;
        if (logs.groupName == null) return null;
        if (logs.streamName == null) return null;
        const output = await collectLogsOutput(logs.groupName, [logs.streamName], credentials, logger);
        const timeRange = renderDuration(
          toTemporalInstant.call(firstStartTime).until(toTemporalInstant.call(lastEndTime ?? lastStartTime)),
        );
        ctx.logger.info('Output collected from logs.', { output });

        const builtInfo: BuiltInfo = {
          ...outputBuiltInfoSchema.parse(output),
          timeRange,
        };
        return builtInfo;
      };

      ctx.logger.info('Get last status.', { buildStatus: last.buildStatus });
      const builtInfo = last.buildStatus === 'SUCCEEDED' ? await computeBuiltInfo() : null;
      ctx.logger.info('Built info.', { builtInfo });
      const imageDetail =
        builtInfo &&
        (await getImageDetailByTag(
          {
            imageRegion,
            ...entry,
            ...builtInfo,
          },
          credentials,
          logger,
        ));

      const values: CommentValues = {
        buildStatus: last.buildStatus,
        statusChangedAt: toTemporalInstant.call(lastEndTime ?? lastStartTime),
        deepLogLink: last.logs?.deepLink,
        builtInfo,
        imageDetail,
      };

      return {
        status: ({ SUCCEEDED: 'success', FAILED: 'failure' } as const)[last.buildStatus] ?? 'undone',
        entry,
        values,
      };
    },
  };
  return cmd;
};

export default createCmd;
