import { spawn } from 'child_process';
import type { OutputBuiltInfo } from '@self/shared/lib/operate-env/built-info';
import { outputBuiltInfo } from '@self/shared/lib/util/codebuild';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { asyncIter } from 'ballvalve';
import { PassThrough } from 'stream';
import { ECS } from 'aws-sdk';
import type { OpOutput } from '@self/shared/lib/operate-env/output';
import { scriptOpEnvSchema } from '../lib/operate-env/op-env';

const main = async () => {
  initEnv();

  const scriptOpEnv = scriptOpEnvSchema.parse(process.env);

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
      asyncIter<Buffer>(proc.stdout)
        .collect()
        .then((b) => Buffer.concat(b).toString('utf-8')),
      asyncIter<Buffer>(proc.stderr)
        .collect()
        .then((b) => Buffer.concat(b).toString('utf-8')),
    ]);
    await prom;
    if (proc.exitCode !== 0) throw new Error(`exit with ${proc.exitCode}`);
    return { stdout, stderr };
  };

  const tfOutput = async <T extends keyof OpOutput>(name: T): Promise<Record<T, string>> => {
    const output = {
      [name]: (
        await e('terraform', [
          '-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra',
          'output',
          '-raw',
          `opOutputs-${name}`,
        ])
      ).stdout.trim(),
    };
    return output as any;
  };

  const apiTaskRun = async (prismaArgs: string[]) => {
    const { apiTaskDefinitionArn } = await tfOutput('apiTaskDefinitionArn');
    const ecs = new ECS();
    const res = await ecs
      .runTask({
        taskDefinition: apiTaskDefinitionArn,
        propagateTags: 'TASK_DEFINITION',
        launchType: 'FARGATE',
        overrides: {
          containerOverrides: [
            {
              name: 'api',
              command: ['pnpm', '--dir=./packages/api', 'exec', 'prisma', ...prismaArgs],
              cpu: 256,
              memory: 512,
            },
          ],
        },
      })
      .promise();
    return res;
  };

  const operate = async (tfCmd: string, tfArgs: string[], tryCount: number): Promise<void> => {
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
        await e('terraform', ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', tfCmd, ...tfArgs]);
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
      ...(await tfOutput('apiURL')),
      ...(await tfOutput('webURL')),
    };
    outputBuiltInfo(builtInfo);
  };

  switch (scriptOpEnv.OPERATION) {
    case 'deploy': {
      operate('apply', ['--auto-approve'], 2).catch((err) => {
        console.error(err);
        process.exit(1);
      });
      break;
    }
    case 'destroy': {
      operate('destroy', ['--auto-approve'], 2).catch((err) => {
        console.error(err);
        process.exit(1);
      });
      break;
    }
    case 'status': {
      operate('plan', [], 2).catch((err) => {
        console.error(err);
        process.exit(1);
      });
      break;
    }
    case 'recreate': {
      (async () => {
        await operate('destroy', ['--auto-approve'], 2);
        await operate('apply', ['--auto-approve'], 2);
      })().catch((err) => {
        console.error(err);
        process.exit(1);
      });
      break;
    }
    case 'prisma/migrate/deploy': {
      await apiTaskRun(['migrate', 'deploy']);
      break;
    }
    case 'prisma/migrate/reset': {
      await apiTaskRun(['migrate', 'reset']);
      break;
    }
    case 'prisma/db/seed': {
      await apiTaskRun(['db', 'seed']);
      break;
    }
    default: {
      throw new Error(`not implemented: "${scriptOpEnv.OPERATION}"`);
    }
  }
};

main().catch((e) => console.error(e));
