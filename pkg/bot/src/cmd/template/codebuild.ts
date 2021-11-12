import type { Build, StartBuildInput } from '@aws-sdk/client-codebuild';
import { CodeBuild } from '@aws-sdk/client-codebuild';
import type { Credentials, Provider } from '@aws-sdk/types';
import type { Temporal } from '@js-temporal/polyfill';
import { toTemporalInstant } from '@js-temporal/polyfill';
import type { CmdStatus } from '@self/bot/src/type/cmd';
import { renderDuration } from '@self/bot/src/util/comment-render';
import type { Logger } from 'winston';
import { z } from 'zod';

const buildStatusToCmdStatus = {
  FAILED: 'failure',
  FAULT: 'failure',
  IN_PROGRESS: 'undone',
  STOPPED: 'failure',
  SUCCEEDED: 'success',
  TIMED_OUT: 'failure',
} as const;

const buildStrcitSchema = z
  .object({
    buildStatus: z.union([
      z.literal('FAILED'),
      z.literal('FAULT'),
      z.literal('IN_PROGRESS'),
      z.literal('STOPPED'),
      z.literal('SUCCEEDED'),
      z.literal('TIMED_OUT'),
    ]),
    id: z.string(),
    arn: z.string(),
    startTime: z.date(),
  })
  .passthrough();
type BuildStrcit = z.infer<typeof buildStrcitSchema>;

const startBuildOutputStrcitSchema = z
  .object({
    build: buildStrcitSchema,
  })
  .passthrough();
type StartBuildOutputStrcit = z.infer<typeof startBuildOutputStrcitSchema>;

const buildStrcitArraySchema = z.array(buildStrcitSchema);

interface StartBuildParams {
  input: StartBuildInput;
  credentials: Credentials | Provider<Credentials>;
  logger: Logger;
}
export const startBuild = async ({ input, credentials, logger }: StartBuildParams): Promise<StartBuildOutputStrcit> => {
  const codeBuild = new CodeBuild({ credentials, logger });
  const r = await codeBuild.startBuild(input);
  return startBuildOutputStrcitSchema.parse(r);
};

interface GetBuildParams {
  buildId: string;
  credentials: Credentials | Provider<Credentials>;
  logger: Logger;
}
interface GetBuildResult {
  builds: (Build & BuildStrcit)[];
  first: Build & BuildStrcit;
  last: Build & BuildStrcit;
  firstStartTime: Date;
  lastStartTime: Date;
  lastEndTime: Date | undefined;
  timeRange: string;
  status: CmdStatus;
  statusChangedAt: Temporal.Instant;
}
export const getBuild = async ({ buildId, credentials, logger }: GetBuildParams): Promise<GetBuildResult> => {
  const codeBuild = new CodeBuild({ credentials, logger });

  const r = await codeBuild.batchGetBuilds({
    ids: [buildId],
  });

  const builds: (Build & BuildStrcit)[] = buildStrcitArraySchema.parse(r.builds);
  logger.debug('builds', { builds });
  const first = builds[0];
  const last = builds[builds.length - 1];
  const firstStartTime = first.startTime;
  const lastStartTime = last.startTime;
  const lastEndTime = last.endTime;

  const timeRange = renderDuration(
    toTemporalInstant.call(firstStartTime).until(toTemporalInstant.call(lastEndTime ?? lastStartTime)),
  );

  logger.info('Get last status.', { buildStatus: last.buildStatus });

  const status = buildStatusToCmdStatus[last.buildStatus];

  const statusChangedAt = toTemporalInstant.call(lastEndTime ?? lastStartTime);

  return {
    builds,
    first,
    last,
    firstStartTime,
    lastStartTime,
    lastEndTime,
    timeRange,
    status,
    statusChangedAt,
  };
};
