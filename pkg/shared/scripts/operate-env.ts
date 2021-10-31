import { spawn } from 'child_process';
import type { OutputBuiltInfo } from '@self/shared/lib/operate-env/built-info';
import { outputBuiltInfo } from '@self/shared/lib/util/codebuild';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { asyncIter } from 'ballvalve';
import { PassThrough } from 'stream';
import { scriptOpEnvSchema } from '../lib/operate-env/op-env';

initEnv();

const delay = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));

const e = async (file: string, args: string[]): Promise<{ stdout: string; stderr: string }> => {
  console.log(`Running ${[file, ...args].map((a) => JSON.stringify(a)).join(' ')}`);
  const proc = spawn(file, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const prom = new Promise<void>((resolve) =>
    proc.once('exit', () => {
      resolve();
    }),
  );
  proc.stdout.pipe(new PassThrough()).pipe(process.stdout);
  proc.stderr.pipe(new PassThrough()).pipe(process.stderr);
  const [stdout, stderr] = await Promise.all([
    asyncIter(proc.stdout)
      .collect()
      .then((b) => Buffer.from(b).toString('utf-8')),
    asyncIter(proc.stderr)
      .collect()
      .then((b) => Buffer.from(b).toString('utf-8')),
  ]);
  await prom;
  if (proc.exitCode !== 0) throw new Error(`exit with ${proc.exitCode}`);
  return { stdout, stderr };
};

const scriptOpEnv = scriptOpEnvSchema.parse(process.env);

const operate = async (tfargs: string[], tryCount: number): Promise<void> => {
  await e('pnpm', ['--dir', './pkg/def-env', 'run', 'cdktf:synth']);
  await e('terraform', ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', 'init']);
  let succeeded = false;
  for (let i = 0; i < tryCount && !succeeded; i += 1) {
    if (i > 0) {
      console.log('sleeping 10 seconds...');
      await delay(10000);
    }
    succeeded = true;
    try {
      console.log(`${i + 1}-th try...`);
      await e('terraform', ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', ...tfargs]);
    } catch (err: unknown) {
      console.error(err);
      succeeded = false;
    }
  }

  if (!succeeded) {
    throw new Error('failed');
  }

  const builtInfo: OutputBuiltInfo = {
    rev: (await e('git', ['rev-parse', 'HEAD'])).stdout.trim(),
  };
  outputBuiltInfo(builtInfo);
};

switch (scriptOpEnv.OPERATION) {
  case 'deploy': {
    operate(['apply', '--auto-approve'], 2).catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  }
  case 'destroy': {
    operate(['destroy', '--auto-approve'], 2).catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  }
  case 'recreate': {
    (async () => {
      await operate(['destroy', '--auto-approve'], 2);
      await operate(['apply', '--auto-approve'], 2);
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  }
  default: {
    throw new Error('unreachable');
  }
}
