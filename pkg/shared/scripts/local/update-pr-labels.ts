import arg from 'arg';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { createOctokit } from '@self/shared/lib/bot/octokit';
import { computedBotEnvSchema } from '@self/shared/lib/bot/env';
import { requireSecrets } from '@self/shared/lib/bot/secrets';
import { createLambdaLogger } from '@self/bot/src/util/loggers';
import { getLambdaCredentials } from '@self/bot/src/app/aws';
import { getLabelInfo, isManagedLabel } from '@self/shared/lib/bot/pr-tag';
import { exec } from '@self/shared/lib/util/exec';
import { createTmpdirContext } from '@self/shared/lib/util/tmpdir';
import { parsePr, prAnalyze } from '../../lib/bot/pr-analyze';

interface Params {
  owner: string;
  repo: string;
  prNumber: number;
}

const main = async ({ repo, owner, prNumber }: Params): Promise<void> => {
  initEnv();

  const calcLabels = async (baseRef: string, targetRef: string): Promise<string[]> => {
    const tmpdirCtx = createTmpdirContext();
    const tmpdir = tmpdirCtx.open();
    try {
      await exec('git', ['init'], true, { cwd: tmpdir });
      await exec('git', ['remote', 'add', 'origin', `https://github.com/${owner}/${repo}.git`], true, { cwd: tmpdir });
      await exec('git', ['fetch', `origin`, baseRef], true, { cwd: tmpdir });
      await exec('git', ['branch', `base`, 'FETCH_HEAD'], true, { cwd: tmpdir });
      await exec('git', ['fetch', `origin`, targetRef], true, { cwd: tmpdir });
      await exec('git', ['branch', `target`, 'FETCH_HEAD'], true, { cwd: tmpdir });
      await exec('git', ['checkout', `target`], true, { cwd: tmpdir });
      await exec('git', ['diff', `target`], true, { cwd: tmpdir });

      const params = parsePr({
        dockerfilesOutput: (
          await exec('find', ['./docker/', '-type', 'f', '-a', '-name', 'Dockerfile'], true, {
            cwd: tmpdir,
          })
        ).stdout,
        projectPackagesOutput: (
          await exec('find', ['./pkg/', '-type', 'f', '-a', '-name', 'Dockerfile'], true, {
            cwd: tmpdir,
          })
        ).stdout,
        diffOutput: (await exec('git', ['diff', '--no-color'], true, { cwd: tmpdir })).stdout,
        diffNamesOutput: (await exec('git', ['diff', '--no-color', '--name-only'], true, { cwd: tmpdir })).stdout,
        logOutput: (await exec('git', ['log', '--no-color', 'base..HEAD', '--format=format:%s'], true, { cwd: tmpdir }))
          .stdout,
      });

      const labels = prAnalyze(params);
      return labels;
    } finally {
      tmpdirCtx.close();
    }
  };

  const credentials = getLambdaCredentials();
  const logger = createLambdaLogger('local-tags-pr');

  const env = computedBotEnvSchema.parse(process.env);
  const secrets = await requireSecrets(env, credentials, logger);
  const botInstallationId = Number.parseInt(process.env.BOT_INSTALLATION_ID ?? '0', 10);
  const octokit = await createOctokit(secrets, botInstallationId);

  const pr = await octokit.pulls.get({ repo, owner, pull_number: prNumber });
  const baseRef = pr.data.base.ref;

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
  '--pr': Number,
});

main({
  owner: args['--owner'] ?? '',
  repo: args['--repo'] ?? '',
  prNumber: args['--pr'] ?? 0,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
