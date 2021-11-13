import { CodeBuild } from '@aws-sdk/client-codebuild';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import type { Credentials, Provider } from '@aws-sdk/types';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { toTemporalInstant } from '@js-temporal/polyfill';
import type { Octokit } from '@octokit/rest';
import { Webhooks } from '@octokit/webhooks';
import type { IssueCommentEvent } from '@octokit/webhooks-types';
import { runMain } from '@self/bot/src/app/cmd';
import { issueMapEntrySchema } from '@self/bot/src/type/issue-map';
import type { AccumuratedBotEnv, BotSecrets } from '@self/shared/lib/bot/env';
import { createOctokit } from '@self/shared/lib/bot/octokit';
import { dynamicRunScriptCodeBuildEnv } from '@self/shared/lib/run-script/env';
import { dynamicUpdatePrLabelsEnvCodeBuildEnv } from '@self/shared/lib/update-pr-labels/env';
import arg from 'arg';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'winston';
import { z } from 'zod';
import { toBoundCmd } from '../cmd/meta/construct';
import type { BoundReplyCmd, CommandContext, GeneralEntry } from '../type/cmd';
import { parseComment } from '../util/parse-comment';

// TODO(hardcoded)
const botPrefix = '/';

export const processBoundCmd = async (
  boundCmd: BoundReplyCmd,
  octokit: Octokit,
  env: AccumuratedBotEnv,
  payload: IssueCommentEvent,
  botInstallationId: number,
  credentials: Credentials | Provider<Credentials>,
  logger: Logger,
): Promise<void> => {
  const { id: callerId, login: callerName } = payload.comment.user;
  const prNumber = payload.issue.number;
  const db = new DynamoDB({ credentials, logger });
  const item = (
    await db.getItem({
      TableName: env.BOT_ISSUE_MAP_TABLE_NAME,
      Key: { number: { N: prNumber.toString() } },
    })
  ).Item;
  const i = item && issueMapEntrySchema.parse(unmarshall(item));
  const defaultNamespace = payload.issue.user.login.toLowerCase();
  const setNamespace = i?.namespace;
  const parsedArgs = arg({ '--ns': String }, { argv: boundCmd.boundArgs, permissive: true });
  const namespace = parsedArgs['--ns'] || setNamespace || defaultNamespace;
  const ctx: CommandContext = {
    octokit,
    env,
    commentPayload: payload,
    namespace,
    credentials,
    logger,
  };

  const uuid = uuidv4();
  const date = new Date();

  const startedAt = toTemporalInstant.call(date).epochMilliseconds;
  const generalEntry: GeneralEntry = {
    uuid,
    ttl: toTemporalInstant.call(date).add({ hours: 24 * 7 }).epochSeconds,
    name: boundCmd.cmd.name,
    callerId,
    callerName,
    namespace,
    startedAt,
    updatedAt: startedAt,
    commentOwner: payload.repository.owner.login,
    commentRepo: payload.repository.name,
    commentIssueNumber: payload.issue.number,
    commentId: -1,
    botInstallationId,
  };

  await runMain(boundCmd.cmd, ctx, boundCmd.boundArgs, generalEntry, true);
};

// Webhook doc: https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks
export const createWebhooks = (
  env: AccumuratedBotEnv,
  secrets: BotSecrets,
  credentials: Credentials | Provider<Credentials>,
  logger: Logger,
): { webhooks: Webhooks; onAllDone: () => Promise<void> } => {
  const webhooks = new Webhooks({
    secret: secrets.WEBHOOKS_SECRET,
  });

  const waitList = new Set();
  const add = (prom: Promise<unknown>) => {
    waitList.add(prom);
    prom
      .then(() => {
        waitList.delete(prom);
      })
      .catch((e) => {
        waitList.delete(prom);
        throw e;
      });
  };

  webhooks.onAny((all) => {
    logger.info('event received', all.name);
    logger.debug('event received', all);
  });

  // TODO
  // webhooks.on('workflow_run.completed', ({ payload }) => {
  // });

  const onNewPRCommit = async (owner: string, repo: string, prNumber: number, botInstallationId: number) => {
    const codeBuild = new CodeBuild({ credentials, logger });
    const startBuildResult = await codeBuild.startBuild({
      projectName: env.PR_UPDATE_LABELS_PROJECT_NAME,
      environmentVariablesOverride: [
        ...dynamicRunScriptCodeBuildEnv({
          ENTRY_UUID: '',
        }),
        ...dynamicUpdatePrLabelsEnvCodeBuildEnv({
          UPDATE_LABELS_OWNER: owner,
          UPDATE_LABELS_REPO: repo,
          UPDATE_LABELS_PR_NUMBER: prNumber.toString(),
          BOT_INSTALLATION_ID: botInstallationId.toString(),
        }),
      ],
    });
    logger.debug('Build started for PR labels update', { startBuildResult });
  };

  webhooks.on(['pull_request.opened', 'issues.opened'], ({ payload }) => {
    const inner = async () => {
      const db = new DynamoDB({ credentials, logger });
      await db.putItem({
        TableName: env.BOT_ISSUE_MAP_TABLE_NAME,
        Item: {
          number: {
            N: ('issue' in payload ? payload.issue.number : payload.pull_request.number).toString(),
          },
        },
      });
    };
    add(
      inner().catch((e) => {
        logger.error(`Error while running issue_comment reciever`, e);
      }),
    );
  });

  webhooks.on(['pull_request.opened', 'pull_request.edited', 'pull_request.synchronize'], ({ payload }) => {
    const inner = async () => {
      if (payload.pull_request.state === 'closed') return;
      await onNewPRCommit(
        payload.repository.owner.login,
        payload.repository.name,
        payload.pull_request.number,
        z.number().parse(payload.installation?.id),
      );
    };
    add(
      inner().catch((e) => {
        logger.error(`Error while running issue_comment reciever`, e);
      }),
    );
  });

  webhooks.on('issue_comment.created', ({ payload }) => {
    const inner = async () => {
      logger.info('Event issue_comment.created received.');
      logger.info('comment created', payload.comment.user);
      if (payload.comment.user.type !== 'User') return;
      // TODO(hardcoded)
      if (!['LumaKernel', 'solufa', 'maihrs55', 'shuheiest', 'naoya502'].includes(payload.comment.user.login)) return;
      logger.info('Authentication success.');

      const botInstallationId = z.number().parse(payload.installation?.id);
      const octokit = await createOctokit(secrets, botInstallationId);
      const parsed = parseComment(payload.comment.body, botPrefix);
      logger.debug(`Comment parsed.`, { parsed });
      if (parsed.length) {
        const boundCmd = toBoundCmd(parsed);

        await processBoundCmd(boundCmd, octokit, env, payload, botInstallationId, credentials, logger);
      }
    };
    add(
      inner().catch((e) => {
        logger.error(`Error while running issue_comment reciever`, e);
      }),
    );
  });
  return {
    webhooks,
    onAllDone: async () => {
      await Promise.all([...waitList]);
    },
  };
};
