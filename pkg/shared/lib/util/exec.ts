import { asyncIter } from 'ballvalve';
import type { SpawnOptionsWithStdioTuple, StdioNull, StdioPipe } from 'child_process';
import { spawn } from 'child_process';
import { PassThrough } from 'stream';

export type ExecOptions = Omit<SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe>, 'stdio'>;

export const exec = async (
  file: string,
  args: string[],
  silent: boolean,
  options?: ExecOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> => {
  const proc = spawn(file, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const prom = new Promise<void>((resolve) =>
    proc.once('exit', () => {
      resolve();
    }),
  );
  if (!silent) {
    proc.stdout.pipe(new PassThrough()).pipe(process.stdout);
    proc.stderr.pipe(new PassThrough()).pipe(process.stderr);
  }
  const [stdout, stderr] = await Promise.all([
    asyncIter<Buffer>(proc.stdout)
      .collect()
      .then((b) => `${Buffer.concat(b).toString('utf-8')}\n`),
    asyncIter<Buffer>(proc.stderr)
      .collect()
      .then((b) => `${Buffer.concat(b).toString('utf-8')}\n`),
  ]);
  await prom;
  return { stdout, stderr, exitCode: proc.exitCode };
};

export const execThrow = async (
  file: string,
  args: string[],
  silent: boolean,
  options?: ExecOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> => {
  const { stdout, stderr, exitCode } = await exec(file, args, silent, options);
  if (exitCode !== 0) {
    throw Object.assign(new Error(`exit code is not 0`), {
      args: [file, ...args],
      options,
      stdout,
      stderr,
      exitCode,
    });
  }
  return { stdout, stderr, exitCode };
};
