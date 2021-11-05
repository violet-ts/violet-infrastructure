import { asyncIter } from 'ballvalve';
import type { SpawnOptionsWithStdioTuple, StdioNull, StdioPipe } from 'child_process';
import { spawn } from 'child_process';
import { PassThrough } from 'stream';

export const exec = async (
  file: string,
  args: string[],
  silent: boolean,
  options?: Omit<SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe>, 'stdio'>,
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
