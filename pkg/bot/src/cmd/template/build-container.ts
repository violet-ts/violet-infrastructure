import type { Temporal } from '@js-temporal/polyfill';
import { toTemporalInstant } from '@js-temporal/polyfill';
import type { ReplyCmd, ReplyCmdStatic } from '@self/bot/src/type/cmd';
import { getImageDetailByTag } from '@self/bot/src/util/aws/ecr';
import { collectLogsOutput } from '@self/bot/src/util/aws/logs-output';
import { renderAnchor, renderBytes, renderTimestamp } from '@self/bot/src/util/comment-render';
import { renderECRImageDigest } from '@self/bot/src/util/comment-render/aws';
import { renderGitHubPRCommit } from '@self/bot/src/util/comment-render/github';
import { hintHowToPullDocker } from '@self/bot/src/util/hint';
import type { AccumuratedBotEnv } from '@self/shared/lib/bot/env';
import { dynamicBuildCodeBuildEnv } from '@self/shared/lib/build-env';
import { z } from 'zod';
import { getBuild, startBuild } from './codebuild';

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
  builtInfo?: OutputBuiltInfo | null;
  imageDetail?: ImageDetail | null;
  timeRange?: string | null;
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
      const imageTag = ctx.namespace;
      const params = paramsGetter(ctx.env, ctx.namespace);
      const r = await startBuild({
        input: {
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
        },
        credentials,
        logger,
      });

      const entry: Entry = {
        prNumber,
        buildId: r.build.id,
        imageTag,
        imageRepoName: params.imageRepoName,
      };

      const values: CommentValues = {
        buildStatus: r.build.buildStatus,
        statusChangedAt: toTemporalInstant.call(r.build.startTime),
      };

      return {
        status: 'undone',
        entry,
        values,
        watchTriggers: new Set([r.build.arn]),
      };
    },
    constructComment(entry, values, ctx) {
      const params = paramsGetter(ctx.env, entry.namespace);
      const { builtInfo, imageDetail, timeRange } = values;
      const buildUrl = `https://${imageRegion}.console.aws.amazon.com/codesuite/codebuild/projects/${
        params.projectName
      }/build/${encodeURIComponent(entry.buildId)}/`;
      return {
        mode: 'ul',
        main: [
          `ビルドステータス: ${values.buildStatus} (${renderTimestamp(values.statusChangedAt)})`,
          imageDetail && `イメージサイズ: ${renderBytes(imageDetail.imageSizeInBytes)}`,
          builtInfo &&
            `使用コミット: ${renderGitHubPRCommit({
              rev: builtInfo.rev,
              prNumber: entry.prNumber,
              owner: entry.commentOwner,
              repo: entry.commentRepo,
            })}`,
          timeRange && `ビルド時間: ${timeRange}`,
        ],
        hints: [
          {
            title: '詳細',
            mode: 'ul',
            body: {
              main: [
                builtInfo &&
                  imageDetail &&
                  `イメージダイジェスト: ${renderECRImageDigest({ ...imageDetail, ...builtInfo })}`,
                `ビルドID: ${renderAnchor(entry.buildId, buildUrl)}`,
                values.deepLogLink && renderAnchor('ビルドの詳細ログ (CloudWatch Logs)', values.deepLogLink),
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
      const { last, statusChangedAt, status } = await getBuild({
        buildId: entry.buildId,
        credentials,
        logger,
      });

      const computeBuiltInfo = async (): Promise<OutputBuiltInfo | null> => {
        ctx.logger.info('Checking cloudwatch logs.', { logs: last.logs });
        const { logs } = last;
        if (logs == null) return null;
        if (logs.groupName == null) return null;
        if (logs.streamName == null) return null;
        const output = await collectLogsOutput(logs.groupName, [logs.streamName], credentials, logger);
        ctx.logger.info('Output collected from logs.', { output });

        return outputBuiltInfoSchema.parse(output);
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
        statusChangedAt,
        deepLogLink: last.logs?.deepLink,
        builtInfo,
        imageDetail,
      };

      return {
        status,
        values,
      };
    },
  };
  return cmd;
};

export default createCmd;
