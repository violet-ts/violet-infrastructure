import { spawn } from 'child_process';
import type { GeneralBuildOutput, RunTaskBuildOutput, TfBuildOutput } from '@self/shared/lib/operate-env/build-output';
import { tfBuildOutputSchema } from '@self/shared/lib/operate-env/build-output';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { asyncIter } from 'ballvalve';
import { PassThrough } from 'stream';
import { ECS, DynamoDB } from 'aws-sdk';
import { marshall } from '@aws-sdk/util-dynamodb';
import { configureAws } from '@self/bot/src/app/aws';
import { z } from 'zod';
import { scriptOpEnvSchema, computedOpEnvSchema } from '../lib/operate-env/op-env';

// TODO(logging): logger

const main = async (): Promise<void> => {
  initEnv();

  // NOTE: ローカル実行用
  configureAws();

  const scriptOpEnv = scriptOpEnvSchema.parse(process.env);
  const computedOpEnv = computedOpEnvSchema.parse(process.env);

  // TODO(hardcoded)
  const botTableRegion = 'ap-northeast-1';
  const entryURL = `https://${botTableRegion}.console.aws.amazon.com/dynamodbv2/home#item-explorer?autoScanAttribute=null&initialTagKey=&table=${computedOpEnv.BOT_TABLE_NAME}`;

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
        TableName: computedOpEnv.BOT_TABLE_NAME,
        Key: {
          uuid: { S: scriptOpEnv.ENTRY_UUID },
        },
        UpdateExpression: `SET ${expr}`,
        ExpressionAttributeNames: keys,
        ExpressionAttributeValues: values,
      })
      .promise();
  };

  const e = async (file: string, args: string[], silent: boolean): Promise<{ stdout: string; stderr: string }> => {
    console.log(`Running ${[file, ...args].map((a) => JSON.stringify(a)).join(' ')}`);
    const proc = spawn(file, args, {
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
    if (proc.exitCode !== 0) {
      if (silent) console.error({ stdout, stderr });
      throw new Error(`exit with ${proc.exitCode}`);
    }
    return { stdout, stderr };
  };

  await updateTable<GeneralBuildOutput>({
    generalBuildOutput: {
      rev: (await e('git', ['rev-parse', 'HEAD'], false)).stdout.trim(),
    },
  });

  const tfOutput = async (name: string): Promise<string> => {
    const output = (
      await e(
        'terraform',
        ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', 'output', '-raw', `opOutputs-${name}`],
        true,
      )
    ).stdout.trim();
    return output;
  };

  const getTfBuildOutput = async () =>
    tfBuildOutputSchema.shape.tfBuildOutput
      .unwrap()
      .parse(
        Object.fromEntries(
          await Promise.all(
            Object.keys(tfBuildOutputSchema.shape.tfBuildOutput.unwrap().shape).map(async (key) => [
              key,
              await tfOutput(key),
            ]),
          ),
        ),
      );

  const apiPrismaTaskRun = async (prismaArgs: string[]) => {
    await e('pnpm', ['--dir', './pkg/def-env', 'run', 'cdktf:synth'], false);
    await e('terraform', ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', 'init'], false);

    const tfBuildOutput = await getTfBuildOutput();

    const ecs = new ECS({ region: tfBuildOutput.envRegion });
    // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_RunTask.html
    const task = await (async () => {
      const res = await ecs
        .runTask({
          cluster: tfBuildOutput.ecsClusterName,
          networkConfiguration: {
            awsvpcConfiguration: {
              subnets: [computedOpEnv.NETWORK_PUB_ID0, computedOpEnv.NETWORK_PUB_ID1, computedOpEnv.NETWORK_PUB_ID2],
              securityGroups: [computedOpEnv.NETWORK_SVC_SG_ID],
              // // TODO(security): NAT
              assignPublicIp: 'ENABLED',
            },
          },
          taskDefinition: tfBuildOutput.apiTaskDefinitionArn,
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
      console.log(res);
      const task = res.tasks?.[0];
      if (task == null) throw new Error('run task not found');
      return task;
    })();

    await updateTable<RunTaskBuildOutput>({
      runTaskBuildOutput: {
        taskArn: z.string().parse(task.taskArn),
      },
    });

    return task;
  };

  const operate = async (tfCmd: string, tfArgs: string[], minTryCount: number, maxTryCount: number): Promise<void> => {
    let success = 0;
    let failure = 0;
    let lastFailed = false;
    for (let i = 0; success < minTryCount && i < maxTryCount; i += 1) {
      if (i > 0) {
        if (lastFailed) {
          console.log('sleeping 10 seconds...');
          await delay(10000);
        } else {
          console.log('sleeping 1 second...');
          await delay(1000);
        }
      }
      lastFailed = false;
      try {
        console.log(`${i + 1}-th run... (success=${success}, failure=${failure})`);
        await e('terraform', ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', tfCmd, ...tfArgs], false);
        success += 1;
      } catch (err: unknown) {
        console.error(`${i + 1}-th run failed`);
        console.error(err);
        failure += 1;
        lastFailed = true;
      }
    }

    console.log(`Run finished. (success=${success}, failure=${failure})`);

    if (success < minTryCount) {
      throw new Error('run failed');
    }
  };

  switch (scriptOpEnv.OPERATION) {
    case 'deploy': {
      await operate('apply', ['--auto-approve'], 2, 3);
      const tfBuildOutput = await getTfBuildOutput();
      await updateTable<TfBuildOutput>({
        tfBuildOutput,
      });
      break;
    }
    case 'destroy': {
      await operate('destroy', ['--auto-approve'], 1, 2);
      const tfBuildOutput = await getTfBuildOutput();
      await updateTable<TfBuildOutput>({
        tfBuildOutput,
      });
      break;
    }
    case 'status': {
      await operate('plan', [], 1, 2);
      const tfBuildOutput = await getTfBuildOutput();
      await updateTable<TfBuildOutput>({
        tfBuildOutput,
      });
      break;
    }
    case 'recreate': {
      await operate('destroy', ['--auto-approve'], 1, 2);
      await operate('apply', ['--auto-approve'], 1, 2);
      const tfBuildOutput = await getTfBuildOutput();
      await updateTable<TfBuildOutput>({
        tfBuildOutput,
      });
      break;
    }
    case 'prisma/migrate/deploy': {
      await apiPrismaTaskRun(['migrate', 'deploy']);
      break;
    }
    case 'prisma/migrate/reset': {
      await apiPrismaTaskRun(['migrate', 'reset']);
      break;
    }
    case 'prisma/db/seed': {
      await apiPrismaTaskRun(['db', 'seed']);
      break;
    }
    default: {
      throw new Error(`not implemented: "${scriptOpEnv.OPERATION}"`);
    }
  }

  console.log(`Table: ${entryURL}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
