import { DynamoDB } from 'aws-sdk';
import { marshall } from '@aws-sdk/util-dynamodb';
import type { Logger } from 'winston';
import { Webhooks } from '@octokit/webhooks';
import type { IssueCommentEvent } from '@octokit/webhooks-types';
import type { Octokit } from '@octokit/rest';
import { v4 as uuidv4 } from 'uuid';
import type { Command } from '../util/parse-comment';
import { embedDirective, parseComment } from '../util/parse-comment';
import { createOctokit } from './github-app';
import { cmds } from './cmds';
import type { Env } from './env-vars';
import type { BasicContext, CommandContext, GeneralEntry, ReplyCmd } from '../type/cmd';
import { renderCommentBody, renderTimestamp } from '../util/comment-render';
import type { Secrets } from './secrets';

// TODO(hardcoded)
const botName = 'viola-bot';

export const constructFullComment = (
  cmd: ReplyCmd,
  entry: GeneralEntry,
  values: undefined,
  ctx: BasicContext,
): string => {
  const commentHead = [embedDirective(`mark:${cmd.cmd}:${entry.uuid}`), `@${entry.callerName}`, '', ''].join('\n');
  const commentBodyStruct = cmd.constructComment(entry, values, ctx);
  const comment = renderCommentBody({
    main: commentBodyStruct.main,
    hints: [
      ...(commentBodyStruct.hints ?? []),
      {
        title: '詳細',
        body: {
          main: [`- 最終更新: ${renderTimestamp(new Date(Date.parse(entry.lastUpdate)))}`],
        },
      },
    ],
  });

  const full = commentHead + comment;
  return full;
};

const processRun = async (run: Command, octokit: Octokit, env: Env, payload: IssueCommentEvent, logger: Logger) => {
  logger.info('Trying to run', run.args);
  const [cmdName, ...args] = run.args;
  const cmd = cmds.find((cmd) => cmd.cmd === cmdName);
  const { id: callerId, login: callerName } = payload.comment.user;

  if (cmd == null) {
    logger.info('Not found');
    const mes = renderCommentBody({
      main: [`@${payload.comment.user.login} エラー。コマンド ${cmdName} は存在しません。`],
      hints: [
        {
          title: 'ヒント',
          body: {
            main: [`- <code>@${botName} help</code> でヘルプを表示できます。`],
          },
        },
      ],
    });

    logger.info('Creating comment for failure...');
    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: mes,
    });
    return;
  }

  const ctx: CommandContext = {
    octokit,
    env,
    originalArgs: run.args,
    commentPayload: payload,
    logger,
  };
  const { save, entry, values } = await cmd.main(ctx, args);
  const uuid = uuidv4();
  const date = new Date();
  const generalEntry: GeneralEntry = {
    uuid,
    name: cmd.cmd,
    callerId,
    callerName,
    lastUpdate: date.toISOString(),
    commentOwner: payload.repository.owner.login,
    commentRepo: payload.repository.name,
    commentIssueNumber: payload.issue.number,
    commentId: -1,
  };

  const fullEntry = { ...entry, ...generalEntry };
  const full = constructFullComment(cmd, fullEntry, values, ctx);

  logger.info('Creating comment for success...');
  const createdComment = await octokit.issues.createComment({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    body: full,
  });
  logger.info('Comment created', createdComment);
  fullEntry.commentId = createdComment.data.id;

  if (save) {
    logger.info('Saving result...');
    const db = new DynamoDB();
    await db
      .putItem({
        TableName: env.TABLE_NAME,
        Item: marshall(fullEntry),
      })
      .promise();
  }
};

// Webhook doc: https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks
export const createWebhooks = (
  env: Env,
  secrets: Secrets,
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

  webhooks.on('issue_comment', ({ payload }) => {
    const inner = async () => {
      logger.info('Event issue_comment received.');
      if (payload.action !== 'created') return;
      logger.info('comment created', payload.comment.user);
      if (payload.comment.user.type !== 'User') return;
      // TODO(hardcoded)
      if (!['LumaKernel', 'solufa'].includes(payload.comment.user.login)) return;
      logger.info('Authentication success.');

      const octokit = await createOctokit(env, secrets);
      const runs = parseComment(payload.comment.body, botName);
      logger.info(`${runs.length} runs detected.`);

      // eslint-disable-next-line no-restricted-syntax
      for await (const run of runs) {
        await processRun(run, octokit, env, payload, logger).catch((e) => {
          logger.error(`Error while running ${run.args}`, e);
        });
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
