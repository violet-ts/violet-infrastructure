import { DynamoDB } from '@aws-sdk/client-dynamodb';
import type { Credentials, Provider } from '@aws-sdk/types';
import { marshall } from '@aws-sdk/util-dynamodb';
import type { WorkflowRunEvent } from '@octokit/webhooks-types';
import { ensureIssueMap } from '@self/bot/src/app/issue-map';
import type { IssueMapEntry } from '@self/bot/src/type/issue-map';
import { renderNextBuildSummary } from '@self/bot/src/util/comment-render/next-build-summary';
import { parseActionsOutput, parseNextBuildOutput } from '@self/bot/src/util/next-build-summary/parse';
import type { AccumuratedBotEnv, BotSecrets } from '@self/shared/lib/bot/env';
import { createOctokit } from '@self/shared/lib/bot/octokit';
import { createTmpdirContext } from '@self/shared/lib/util/tmpdir';
import extractZip from 'extract-zip';
import * as fs from 'fs';
import * as path from 'path';
import type { Logger } from 'winston';
import { z } from 'zod';

interface Params {
  env: AccumuratedBotEnv;
  payload: WorkflowRunEvent;
  secrets: BotSecrets;
  credentials: Credentials | Provider<Credentials>;
  logger: Logger;
}
const main = async ({ payload, secrets, env, credentials, logger }: Params): Promise<void> => {
  const botInstallationId = z.number().parse(payload.installation?.id);
  const octokit = await createOctokit(secrets, botInstallationId);
  const prNumber = payload.workflow_run.pull_requests[0]?.number as number | undefined;
  if (prNumber == null) {
    logger.info('No PR Number found.');
    return;
  }
  const { nextBuildSummaryCommentId: oldCommentId } = await ensureIssueMap({
    env,
    credentials,
    logger,
    prNumber,
  });
  const owner = payload.workflow_run.repository.owner.login;
  const repo = payload.workflow_run.repository.name;
  const logs = await octokit.actions.downloadWorkflowRunLogs({
    owner,
    repo,
    run_id: payload.workflow_run.id,
  });
  const logsData = logs.data;
  if (!(logsData instanceof ArrayBuffer))
    throw new Error(`logsData is not ArrayBuffer: ${typeof logsData}: ${logsData}`);
  const tmp = createTmpdirContext();
  const tmpDir = tmp.open();
  try {
    const zipPath = path.resolve(tmpDir, 'logs.zip');
    const logsDirPath = path.resolve(tmpDir, 'logs');
    fs.writeFileSync(zipPath, Buffer.from(logsData));
    await extractZip(zipPath, {
      dir: logsDirPath,
    });
    const output = fs
      .readdirSync(logsDirPath, { withFileTypes: true })
      .filter((f) => f.isFile())
      .flatMap((f) =>
        fs
          .readFileSync(path.resolve(logsDirPath, f.name))
          .toString()
          .split(/[\r\n]+/),
      );
    const buildOutput = parseActionsOutput(output);
    const buildSummary = parseNextBuildOutput(buildOutput);
    const comment = renderNextBuildSummary(buildSummary);
    const key: keyof IssueMapEntry = 'nextBuildSummaryCommentId';
    const db = new DynamoDB({ credentials, logger });
    if (oldCommentId == null) {
      const createdComment = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: comment,
      });
      logger.debug('Comment created', { createdComment });
      await db.updateItem({
        TableName: env.BOT_ISSUE_MAP_TABLE_NAME,
        Key: {
          number: {
            N: prNumber.toString(),
          },
        },
        UpdateExpression: `SET #key = :id`,
        ExpressionAttributeNames: {
          '#key': key,
        },
        ExpressionAttributeValues: marshall({
          ':id': createdComment.data.id,
        }),
      });
    } else {
      await octokit.issues.updateComment({
        owner,
        repo,
        comment_id: oldCommentId,
        body: comment,
      });
    }
  } finally {
    tmp.close();
  }
};

export default main;
