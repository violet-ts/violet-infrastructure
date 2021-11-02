import { spawn } from 'child_process';
import type { GeneralBuildOutput, TfBuildOutput } from '@self/shared/lib/operate-env/build-output';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { asyncIter } from 'ballvalve';
import { PassThrough } from 'stream';
import { ECS, DynamoDB } from 'aws-sdk';
import { marshall } from '@aws-sdk/util-dynamodb';
import { configureAws } from '@self/bot/src/app/aws';
import { scriptOpEnvSchema } from '../lib/operate-env/op-env';
import type { OpTfOutput } from '../lib/operate-env/output';

const main = async () => {
  initEnv();

  // NOTE: ローカル実行用
  configureAws();

  const scriptOpEnv = scriptOpEnvSchema.parse(process.env);
  // TODO(hardcoded)
  const botTableRegion = 'ap-northeast-1';
  const entryURL = `https://${botTableRegion}.console.aws.amazon.com/dynamodbv2/home#item-explorer?autoScanAttribute=null&initialTagKey=&table=${scriptOpEnv.BOT_TABLE_NAME}`;

  const delay = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const updateTable = async <T extends Record<string, Record<string, string | number | boolean | null>>>(
    outputObj: T,
  ) => {
    const entries = Object.entries(outputObj);
    const expr = entries.map((_entry, i) => `#key${i} = :value${i}`).join(', ');
    const keys = Object.fromEntries(entries.map(([key], i) => [`#key${i}`, key]));
    const values = Object.fromEntries(
      entries.flatMap(([_key, value], i) => Object.entries(marshall({ [`:value${i}`]: value }))),
    );
    const db = new DynamoDB();
    // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.UpdateExpressions.html
    await db
      .updateItem({
        TableName: scriptOpEnv.BOT_TABLE_NAME,
        Key: {
          uuid: { S: scriptOpEnv.ENTRY_UUID },
        },
        UpdateExpression: `SET ${expr}`,
        ExpressionAttributeNames: keys,
        ExpressionAttributeValues: values,
      })
      .promise();
  };

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

  const tfOutput = async <T extends keyof OpTfOutput>(name: T): Promise<Record<T, string>> => {
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

  const operate = async (tfCmd: string, tfArgs: string[], minTryCount: number, maxTryCount: number): Promise<void> => {
    await e('pnpm', ['--dir', './pkg/def-env', 'run', 'cdktf:synth']);
    await e('terraform', ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', 'init']);
    let succeeded = false;
    let success = 0;
    let failure = 0;
    for (let i = 0; i < minTryCount || (i < maxTryCount && !succeeded); i += 1) {
      if (i > 0) {
        console.log('sleeping 10 seconds...');
        await delay(10000);
      }
      succeeded = true;
      try {
        console.log(`${i + 1}-th run... (success=${success}, failure=${failure})`);
        await e('terraform', ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', tfCmd, ...tfArgs]);
        success += 1;
      } catch (err: unknown) {
        console.error(err);
        succeeded = false;
        failure += 1;
      }
    }

    console.log(`Run finished. (success=${success}, failure=${failure})`);

    if (!succeeded) {
      throw new Error('failed');
    }

    await updateTable<TfBuildOutput>({
      tfBuildOutput: {
        ...(await tfOutput('apiURL')),
        ...(await tfOutput('webURL')),
        ...(await tfOutput('ecsClusterRegion')),
        ...(await tfOutput('ecsClusterName')),
      },
    });
  };

  switch (scriptOpEnv.OPERATION) {
    case 'deploy': {
      await operate('apply', ['--auto-approve'], 2, 2);
      break;
    }
    case 'destroy': {
      await operate('destroy', ['--auto-approve'], 1, 2);
      break;
    }
    case 'status': {
      await operate('plan', [], 1, 2);
      break;
    }
    case 'recreate': {
      await operate('destroy', ['--auto-approve'], 1, 2);
      await operate('apply', ['--auto-approve'], 1, 2);
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

  await updateTable<GeneralBuildOutput>({
    generalBuildOutput: {
      rev: (await e('git', ['rev-parse', 'HEAD'])).stdout.trim(),
    },
  });

  console.log(`Table: ${entryURL}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
