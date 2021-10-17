import { CodeBuild } from 'aws-sdk';
import type { ReplyCmd } from '../type/cmd';
import { renderTimestamp } from '../util/comment-render';
import { setupAws } from '../util/hint';
import { collectLogsOutput } from '../util/logs-output';

const name = 'build';
type Name = typeof name;

export interface Entry {
  prNumber: number;
  buildId: string;
  buildArn: string;
}

export interface BuiltInfo {
  rev: string;
  imageSize: string;
  imageTag: string;
  imageRepoName: string;
}

export interface CommentValues {
  buildStatus: string;
  statusChangedAt: Date;
  deepLogLink?: string | null;
  builtInfo?: BuiltInfo | null;
}

const cmd: ReplyCmd<Name, Entry, CommentValues> = {
  cmd: name,
  where: 'pr',
  description: 'build',
  hidden: false,
  async main(ctx, _args) {
    const { number: prNumber } = ctx.commentPayload.issue;
    const codeBuild = new CodeBuild();
    const r = await codeBuild
      .startBuild({
        projectName: ctx.env.API_BUILD_PROJECT_NAME,
        environmentVariablesOverride: [
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
      statusChangedAt: build.startTime,
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
        builtInfo != null && `- イメージサイズ: ${builtInfo.imageSize}`,
        builtInfo != null &&
          `- 使用コミット: [${builtInfo.rev.slice(0, 6)}](https://github.com/LumaKernel/violet/pull/${
            entry.prNumber
          }/commits/${builtInfo.rev})`,
        values.deepLogLink != null && `- [ビルドの詳細ログ (CloudWatch)](${values.deepLogLink})`,
      ],
      hints: [
        builtInfo != null && {
          title: 'Docker イメージの取得方法',
          body: {
            main: [
              '```',
              ...setupAws,
              `aws ecr get-login-password --profile "$AWS_PROFILE" --region ${region} | docker login --username AWS --password-stdin "https://\${AWS_ACCOUNT_ID}.dkr.ecr.${region}.amazonaws.com"`,
              `docker pull "\${AWS_ACCOUNT_ID}.dkr.ecr.${region}.amazonaws.com/${builtInfo.imageRepoName}:${builtInfo.imageTag}"`,
              '# docker logout',
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
    if (builds == null) throw new TypeError('builds not found');
    const last = builds[builds.length - 1];
    if (typeof last.buildStatus !== 'string') throw new TypeError('CodeBuild last buildStatus is not string');
    if (last.startTime == null) throw new TypeError('CodeBuild last startTime is found');

    const computeBuiltInfo = async (): Promise<BuiltInfo | null> => {
      const log = last.logs?.cloudWatchLogs;
      ctx.logger.info(log);
      if (log == null) return null;
      if (log.groupName == null) return null;
      if (log.streamName == null) return null;
      const p = await collectLogsOutput(log.groupName, [log.streamName]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any
      return p as any;
    };
    const builtInfo = last.buildStatus === 'Succeeded' ? await computeBuiltInfo() : null;
    const values: CommentValues = {
      buildStatus: last.buildStatus,
      statusChangedAt: last.endTime ?? last.startTime,
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
