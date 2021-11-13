import { CodeBuild } from '@aws-sdk/client-codebuild';
import type { Temporal } from '@js-temporal/polyfill';
import { toTemporalInstant } from '@js-temporal/polyfill';
import { getBuild } from '@self/bot/src/cmd/template/codebuild';
import type { ReplyCmd, ReplyCmdStatic } from '@self/bot/src/type/cmd';
import { getImageDetailByTag } from '@self/bot/src/util/aws/ecr';
import { renderAnchor, renderCode, renderTimestamp } from '@self/bot/src/util/comment-render';
import {
  renderECRImageDigest,
  renderECSCluster,
  renderLambdaFunction,
  renderResourceGroup,
  renderS3Bucket,
  renderS3Object,
} from '@self/bot/src/util/comment-render/aws';
import type { AccumuratedBotEnv } from '@self/shared/lib/bot/env';
import {
  generalBuildOutputSchema,
  invokeFunctionBuildOutputSchema,
  runTaskBuildOutputSchema,
  tfBuildOutputSchema,
} from '@self/shared/lib/operate-env/build-output';
import type { ScriptOpEnv } from '@self/shared/lib/operate-env/op-env';
import { dynamicOpCodeBuildEnv, scriptOpCodeBuildEnv } from '@self/shared/lib/operate-env/op-env';
import { dynamicRunScriptCodeBuildEnv } from '@self/shared/lib/run-script/env';
import { z } from 'zod';

// TODO(hardcoded)
const imageRegion = 'ap-northeast-1';

const entrySchema = z
  .object({
    prNumber: z.number(),
    buildId: z.string(),
    webImageDigest: z.string(),
    apiImageDigest: z.string(),
  })
  .merge(generalBuildOutputSchema)
  .merge(tfBuildOutputSchema)
  .merge(runTaskBuildOutputSchema)
  .merge(invokeFunctionBuildOutputSchema);
export type Entry = z.infer<typeof entrySchema>;

export interface CommentValues {
  buildStatus: string;
  statusChangedAt: Temporal.Instant;
  deepLogLink?: string | null;
  timeRange?: string | null;
}

interface CreateParams {
  operation: ScriptOpEnv['OPERATION'];
}

export const argSchema = {} as const;
export type ArgSchema = typeof argSchema;

const createCmd = (
  st: ReplyCmdStatic,
  paramsGetter: (env: AccumuratedBotEnv) => CreateParams,
): ReplyCmd<Entry, CommentValues, ArgSchema> => {
  const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
    ...st,
    entrySchema,
    argSchema,
    async main(ctx, _args, generalEntry) {
      const { number: prNumber } = ctx.commentPayload.issue;
      const { credentials, logger } = ctx;

      // TODO: repeated

      const apiImageDetail = await getImageDetailByTag(
        {
          imageRegion,
          imageRepoName: ctx.env.API_REPO_NAME,
          imageTag: ctx.namespace,
        },
        credentials,
        logger,
      );
      if (!apiImageDetail) throw new Error('Image for API not found.');

      const webImageDetail = await getImageDetailByTag(
        {
          imageRegion,
          imageRepoName: ctx.env.WEB_REPO_NAME,
          imageTag: ctx.namespace,
        },
        credentials,
        logger,
      );
      if (!webImageDetail) throw new Error('Image for WEB not found.');

      const lambdaConv2imgImageDetail = await getImageDetailByTag(
        {
          imageRegion,
          imageRepoName: ctx.env.LAMBDA_CONV2IMG_REPO_NAME,
          imageTag: ctx.namespace,
        },
        credentials,
        logger,
      );
      if (!lambdaConv2imgImageDetail) throw new Error('Image for Lambda for Conv2Img not found.');

      const lambdaApiexecImageDetail = await getImageDetailByTag(
        {
          imageRegion,
          imageRepoName: ctx.env.LAMBDA_APIEXEC_REPO_NAME,
          imageTag: ctx.namespace,
        },
        credentials,
        logger,
      );
      if (!lambdaApiexecImageDetail) throw new Error('Image for Lambda for ApiExec not found.');

      const codeBuild = new CodeBuild({ credentials, logger });
      const r = await codeBuild.startBuild({
        projectName: ctx.env.OPERATE_ENV_PROJECT_NAME,
        environmentVariablesOverride: [
          ...dynamicRunScriptCodeBuildEnv({
            ENTRY_UUID: generalEntry.uuid,
          }),
          ...scriptOpCodeBuildEnv({
            OPERATION: paramsGetter(ctx.env).operation,
          }),
          ...dynamicOpCodeBuildEnv({
            TERRAFORM_VERSION: '1.0.9',
            NAMESPACE: ctx.namespace,
            TF_ENV_BACKEND_WORKSPACE: `violet-env-${ctx.env.MANAGER_NAMESPACE}-${ctx.namespace}`,
            API_REPO_SHA: apiImageDetail.imageDigest,
            WEB_REPO_SHA: webImageDetail.imageDigest,
            LAMBDA_CONV2IMG_REPO_SHA: lambdaConv2imgImageDetail.imageDigest,
            LAMBDA_APIEXEC_REPO_SHA: lambdaApiexecImageDetail.imageDigest,
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
        webImageDigest: webImageDetail.imageDigest,
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
        watchTriggers: new Set([build.arn]),
      };
    },
    constructComment(entry, values, ctx) {
      // TODO(hardcoded)
      const region = 'ap-northeast-1';
      const buildUrl = `https://${region}.console.aws.amazon.com/codesuite/codebuild/projects/${
        ctx.env.OPERATE_ENV_PROJECT_NAME
      }/build/${encodeURIComponent(entry.buildId)}/?region=${region}`;
      const { timeRange } = values;
      return {
        mode: 'ul',
        main: [
          `ビルドステータス: ${values.buildStatus} (${renderTimestamp(values.statusChangedAt)})`,
          timeRange && `ビルド時間: ${timeRange}`,
          ...(entry.tfBuildOutput
            ? ((o) => [`api: ${renderAnchor(o.api_url, o.api_url)}`, `web: ${renderAnchor(o.web_url, o.web_url)}`])(
                entry.tfBuildOutput,
              )
            : []),
        ],
        hints: [
          entry.tfBuildOutput &&
            entry.invokeFunctionBuildOutput &&
            ((o, i) => ({
              title: 'Lambda 実行の詳細',
              mode: 'ul',
              body: {
                main: [
                  `Function: ${renderLambdaFunction({
                    region: o.env_region,
                    functionName: i.executedFunctionName,
                  })}`,
                  `ステータスコード: ${i.statusCode}`,
                  `使ったバージョン: ${i.executedVersion ? renderCode(i.executedVersion) : 'no version'}`,
                ],
              },
            }))(entry.tfBuildOutput, entry.invokeFunctionBuildOutput),
          {
            title: '詳細',
            body: {
              mode: 'ul',
              main: [
                `ビルドID: ${renderAnchor(entry.buildId, buildUrl)}`,
                ...(entry.tfBuildOutput ? [] : []),
                `使用した Web イメージダイジェスト: ${renderECRImageDigest({
                  imageRegion,
                  imageDigest: entry.webImageDigest,
                  imageRepoName: ctx.env.WEB_REPO_NAME,
                })}`,
                `使用した API イメージダイジェスト: ${renderECRImageDigest({
                  imageRegion,
                  imageDigest: entry.apiImageDigest,
                  imageRepoName: ctx.env.API_REPO_NAME,
                })}`,
                entry.generalBuildOutput &&
                  `使用したインフラ定義: ${renderS3Object({
                    bucket: entry.generalBuildOutput.sourceZipBucket,
                    key: entry.generalBuildOutput.sourceZipKey,
                  })}`,
                ...(entry.tfBuildOutput && entry.runTaskBuildOutput
                  ? [
                      renderAnchor(
                        'RunTask の詳細ログ (CloudWatch Logs)',
                        `https://${
                          entry.tfBuildOutput.env_region
                        }.console.aws.amazon.com/cloudwatch/home#logsV2:log-groups/log-group/${
                          entry.tfBuildOutput.api_task_log_group_name
                        }/log-events/api${'$252F'}api${'$252F'}${entry.runTaskBuildOutput}`,
                      ),
                    ]
                  : []),
                values.deepLogLink && renderAnchor('ビルドの詳細ログ (CloudWatch Logs)', values.deepLogLink),
                ...(entry.tfBuildOutput
                  ? ((o) => [
                      `Resource Gruop for Env: ${renderResourceGroup({
                        region: o.env_region,
                        resourceGroupName: o.resource_group_name,
                      })}`,
                      `Original S3 Bucket: ${renderS3Bucket({ bucket: o.original_bucket })}`,
                      `Converted S3 Bucket: ${renderS3Bucket({ bucket: o.converted_bucket })}`,
                      `API Exec Function: ${renderLambdaFunction({
                        region: o.env_region,
                        functionName: o.api_exec_function_name,
                      })}`,
                      `Convert To Image Function: ${renderLambdaFunction({
                        region: o.env_region,
                        functionName: o.conv2img_function_name,
                      })}`,
                      `ECS Cluster: ${renderECSCluster({ region: o.env_region, clusterName: o.ecs_cluster_name })}`,
                    ])(entry.tfBuildOutput)
                  : []),
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
  return cmd;
};

export default createCmd;
