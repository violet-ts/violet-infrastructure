import { getCodeBuildCredentials } from '@self/shared/lib/aws';
import { createLambdaLogger } from '@self/shared/lib/loggers';
import { computedBotEnvSchema } from '@self/shared/lib/bot/env';
import { createOctokit } from '@self/shared/lib/bot/octokit';
import { parsePr, prAnalyze } from '@self/shared/lib/bot/pr-analyze';
import { getLabelInfo, isManagedLabel } from '@self/shared/lib/bot/pr-label';
import { requireSecrets } from '@self/shared/lib/bot/secrets';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { computedRunScriptEnvSchema, dynamicRunScriptEnvSchema } from '@self/shared/lib/run-script/env';
import type { DynamicUpdatePrLabelsEnv } from '@self/shared/lib/update-pr-labels/env';
import { dynamicUpdatePrLabelsEnvSchema } from '@self/shared/lib/update-pr-labels/env';
import { exec, execThrow } from '@self/shared/lib/util/exec';
import { createTmpdirContext } from '@self/shared/lib/util/tmpdir';
import arg from 'arg';

const main = async (): Promise<void> => {
  initEnv();

  const credentials = getCodeBuildCredentials();
  const logger = createLambdaLogger('local-tags-pr');

  const {
    UPDATE_LABELS_REPO: repo,
    UPDATE_LABELS_OWNER: owner,
    UPDATE_LABELS_PR_NUMBER: prNumberStr,
    BOT_INSTALLATION_ID,
  } = dynamicUpdatePrLabelsEnvSchema.parse(process.env);

  const env = computedBotEnvSchema
    .merge(dynamicRunScriptEnvSchema)
    .merge(computedRunScriptEnvSchema)
    .parse(process.env);

  const secrets = await requireSecrets(env, credentials, logger);
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
      await execThrow('git', ['checkout', `base`], false, { cwd: tmpdir });
      await execThrow('git', ['checkout', '-b', `merged`], false, { cwd: tmpdir });
      await execThrow('git', ['merge', '--quiet', `target`, '-Xours'], false, { cwd: tmpdir });
      await execThrow('git', ['diff', `base`], false, { cwd: tmpdir });

      const parsePRParams = {
        dockerfilesOutput: (
          await exec('find', ['./docker/', '-type', 'f', '-a', '-name', 'Dockerfile'], false, {
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
  const baseRef = pr.data.base.ref;

  logger.info('Got baseRef.', { baseRef });

  const keepLabels = (await octokit.issues.listLabelsOnIssue({ repo, owner, issue_number: prNumber })).data
    .map((label) => label.name)
    .filter((label) => !isManagedLabel(label));

  const newLabels = await calcLabels(baseRef, `refs/pull/${prNumber}/head`);

  logger.info('Got newLabels.', { newLabels });

  await Promise.all(
    newLabels.map(async (label) => {
      await octokit.issues
        .createLabel({
          repo,
          owner,
          name: label,
          ...getLabelInfo(label),
        })
        .catch(() => {
          console.warn(`Label "${label}" already exists.`);
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
