import * as childProcess from 'child_process';
import * as util from 'util';
import { requireScriptOpEnvVars } from '@self/shared/lib/def/env-vars';
import type { OutputBuiltInfo } from '@self/shared/lib/operate-env/built-info';
import { outputBuiltInfo } from '@self/shared/lib/util/codebuild';

const execFile = util.promisify(childProcess.execFile);

const scriptOpEnv = requireScriptOpEnvVars();

const deploy = async (): Promise<void> => {
  let succeeded = false;
  for (let i = 0; i < 2 && !succeeded; i += 1) {
    succeeded = true;
    try {
      console.log(`${i + 1}-th try to deploy...`);
      await execFile('pnpm', ['-w', '--dir', './pkg/def-env', 'run', 'cdktf:deploy']);
    } catch (err: unknown) {
      console.error(err);
      succeeded = false;
    }
  }

  if (!succeeded) {
    throw new Error('Failed to deploy.');
  }

  const builtInfo: OutputBuiltInfo = {
    rev: (await execFile('git', ['rev-parse', 'HEAD'])).stdout.trim(),
  };
  outputBuiltInfo(builtInfo);
};

if (scriptOpEnv.OPERATION === 'deploy') {
  deploy().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
