import { projectRootDir } from '@self/shared/lib/const';
import { createTmpdirContext } from '@self/shared/lib/util/tmpdir';
import * as fs from 'fs';
import * as path from 'path';
import { execThrow } from '../../lib/util/exec';

const main = async () => {
  await execThrow('git', ['diff', '--exit-code', '--quiet'], false, { cwd: projectRootDir });
  const tmpdirCtx = createTmpdirContext();
  const cwd = tmpdirCtx.open();
  const zipFilepath = path.resolve(cwd, 'self.local.zip');
  try {
    const repoDir = path.resolve(cwd, 'repo');
    fs.mkdirSync(repoDir, { recursive: true });
    const dotGitDir = path.resolve(projectRootDir, '.git');
    await execThrow('cp', ['-r', dotGitDir, repoDir], false, { cwd });
    await execThrow('git', ['checkout', '.'], false, { cwd: repoDir });
    fs.rmSync(path.resolve(repoDir, '.git'), { recursive: true, maxRetries: 3, force: true });
    await execThrow('zip', ['-r', '-q', zipFilepath, '.'], false, { cwd: repoDir });
    await execThrow('cp', [zipFilepath, projectRootDir], false, { cwd });
  } finally {
    tmpdirCtx.close();
  }
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
