// 各種終了時の通知
// event から対象コメントの uuid を特定し、更新をする。
// コメントは uuid さえ特定すれば他の情報を一切必要とせずに更新できるようにしている。
// そのため、uuid を特定する材料さえ見つければ良い。

import type { Handler } from 'aws-lambda';
import { cmds } from '../../app/cmds';
import { createOctokit } from '../../app/github-app';
import { handlers } from '../../app/handlers';
import { constructFullComment } from '../../app/webhooks';
import type { BasicContext as CommandBasicContext, GeneralEntry } from '../../type/cmd';
import type { BasicContext as HandlerBasicContext } from '../../type/handler';
import { requireEnvVars } from '../../app/env-vars';
import { createLambdaLogger } from '../../util/loggers';
import { requireSecrets } from '../../app/secrets';

const handler: Handler = async (event: unknown, context) => {
  const env = requireEnvVars();
  const logger = createLambdaLogger();

  const handlerCtx: HandlerBasicContext = {
    env,
    logger,
  };

  const oldEntry: GeneralEntry | null = await (async () => {
    // eslint-disable-next-line no-restricted-syntax
    for await (const handler of handlers) {
      const tmp = await handler.handle(handlerCtx, event, context);
      if (tmp != null) return tmp;
    }
    return null;
  })();

  if (oldEntry == null) {
    logger.warn('Unknown event.');
    logger.warn('event', event);
    logger.warn('context', context);
    return;
  }

  const secrets = await requireSecrets(env);
  const octokit = await createOctokit(env, secrets);

  const cmd = cmds.find((cmd) => cmd.cmd === oldEntry.name);
  if (cmd == null) {
    logger.error(`Command not found for ${oldEntry.name}`, oldEntry);
    return;
  }
  if (cmd.update == null) {
    logger.info(`No need to update for command ${oldEntry.name}`, oldEntry);
    return;
  }

  const cmdCtx: CommandBasicContext = {
    octokit,
    env,
    logger,
  };

  const { entry, values } = await cmd.update(oldEntry, cmdCtx);
  const newEntry = {
    ...oldEntry,
    ...entry,
    uuid: oldEntry.uuid,
    name: oldEntry.name,
    callerName: oldEntry.callerName,
    callerId: oldEntry.callerId,
    commentRepo: oldEntry.commentRepo,
    commentOwner: oldEntry.commentOwner,
    commentIssueNumber: oldEntry.commentIssueNumber,
    commentId: oldEntry.commentId,
    lastUpdate: new Date().toISOString(),
  };
  const full = constructFullComment(cmd, newEntry, values, cmdCtx);

  await octokit.issues.updateComment({
    owner: newEntry.callerName,
    repo: newEntry.commentRepo,
    comment_id: newEntry.commentId,
    body: full,
  });
};

export { handler };
