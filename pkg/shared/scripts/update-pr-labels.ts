import arg from 'arg';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { createOctokit } from '@self/shared/lib/bot/octokit';
import type { DynamicUpdatePrLabelsEnv } from '@self/shared/lib/update-pr-labels/env';
import { dynamicUpdatePrLabelsEnvSchema } from '@self/shared/lib/update-pr-labels/env';
import { requireSecrets } from '@self/shared/lib/bot/secrets';
import { createLambdaLogger } from '@self/bot/src/util/loggers';
import { getLambdaCredentials } from '@self/bot/src/app/aws';
import { getLabelInfo, isManagedLabel } from '@self/shared/lib/bot/pr-label';
import { execThrow } from '@self/shared/lib/util/exec';
import { createTmpdirContext } from '@self/shared/lib/util/tmpdir';
import { parsePr, prAnalyze } from '@self/shared/lib/bot/pr-analyze';
import { computedRunScriptEnvSchema } from '@self/shared/lib/run-script/env';

const main = async (): Promise<void> => {
  initEnv();

  const credentials = getLambdaCredentials();
  const logger = createLambdaLogger('local-tags-pr');

  const {
    UPDATE_LABELS_REPO: repo,
    UPDATE_LABELS_OWNER: owner,
    UPDATE_LABELS_PR_NUMBER: prNumberStr,
    BOT_INSTALLATION_ID,
  } = dynamicUpdatePrLabelsEnvSchema.parse(process.env);
  const computedRunScriptEnv = computedRunScriptEnvSchema.parse(process.env);
  const secrets = await requireSecrets(computedRunScriptEnv, credentials, logger);
  const botInstallationId = Number.parseInt(BOT_INSTALLATION_ID, 10);
  const octokit = await createOctokit(secrets, botInstallationId);
  const prNumber = Number.parseInt(prNumberStr, 10);

  const calcLabels = async (baseRef: string, targetRef: string): Promise<string[]> => {
    const tmpdirCtx = createTmpdirContext();
    const tmpdir = tmpdirCtx.open();
    try {
      await execThrow('git', ['init'], false, { cwd: tmpdir });
      await execThrow('git', ['remote', 'add', 'origin', `https://github.com/${owner}/${repo}.git`], false, {
        cwd: tmpdir,
      });
      await execThrow('git', ['fetch', '--quiet', `origin`, baseRef], false, { cwd: tmpdir });
      await execThrow('git', ['branch', '--quiet', `base`, 'FETCH_HEAD'], false, { cwd: tmpdir });
      await execThrow('git', ['fetch', '--quiet', `origin`, targetRef], false, { cwd: tmpdir });
      await execThrow('git', ['branch', '--quiet', `target`, 'FETCH_HEAD'], false, { cwd: tmpdir });
      await execThrow('git', ['checkout', '--quiet', `target`], false, { cwd: tmpdir });
      await execThrow('git', ['diff', `target`], false, { cwd: tmpdir });

      const parsePRParams = {
        dockerfilesOutput: (
          await execThrow('find', ['./docker/', '-type', 'f', '-a', '-name', 'Dockerfile'], false, {
            cwd: tmpdir,
          })
        ).stdout,
        projectPackagesOutput: (
          await execThrow('find', ['./pkg/', '-type', 'f', '-a', '-name', 'package.json'], false, {
            cwd: tmpdir,
          })
        ).stdout,
        diffOutput: (await execThrow('git', ['diff', '--no-color', 'base'], false, { cwd: tmpdir })).stdout,
        diffNamesOutput: (await execThrow('git', ['diff', '--no-color', '--name-only', 'base'], false, { cwd: tmpdir }))
          .stdout,
        logOutput: (
          await execThrow('git', ['log', '--no-color', 'base..HEAD', '--format=format:%s'], false, { cwd: tmpdir })
        ).stdout,
      };

      logger.debug('Calculated pr params.', { parsePRParams });

      const params = parsePr(parsePRParams);

      logger.debug('Calculated pr params analysis.', { params });

      const labels = prAnalyze(params);
      return labels;
    } finally {
      tmpdirCtx.close();
    }
  };

  const pr = await octokit.pulls.get({ repo, owner, pull_number: prNumber });
  const baseRef = pr.data.base.sha;

  logger.info('Got baseRef.', { baseRef });

  const keepLabels = (await octokit.issues.listLabelsOnIssue({ repo, owner, issue_number: prNumber })).data
    .map((label) => label.name)
    .filter((label) => !isManagedLabel(label));

  const newLabels = await calcLabels(baseRef, `refs/pull/${prNumber}/head`);

  logger.info('Got newLabels.', { newLabels });

  const repoLabels = (await octokit.issues.listLabelsForRepo({ repo, owner })).data.map((label) => label.name);
  const createLabels = newLabels.filter((label) => !repoLabels.includes(label));
  await Promise.all(
    createLabels.map(async (newLabel) => {
      await octokit.issues.createLabel({
        repo,
        owner,
        issue_number: prNumber,
        name: newLabel,
        ...getLabelInfo(newLabel),
      });
    }),
  );
  await octokit.issues.setLabels({ repo, owner, issue_number: prNumber, labels: [...newLabels, ...keepLabels] });
};

const args = arg({
  '--owner': String,
  '--repo': String,
  '--pr': String,
});

const dynamicEnv: Partial<DynamicUpdatePrLabelsEnv> = {
  UPDATE_LABELS_OWNER: args['--owner'],
  UPDATE_LABELS_REPO: args['--repo'],
  UPDATE_LABELS_PR_NUMBER: args['--pr'],
};
process.env = { ...dynamicEnv, ...process.env };

main().catch((e) => {
  console.error(e);
  process.exit(1);
});