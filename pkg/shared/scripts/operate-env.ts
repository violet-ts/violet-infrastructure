import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { ECS } from '@aws-sdk/client-ecs';
import { marshall } from '@aws-sdk/util-dynamodb';
import { getCodeBuildCredentials } from '@self/shared/lib/aws';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import type { GeneralBuildOutput, RunTaskBuildOutput, TfBuildOutput } from '@self/shared/lib/operate-env/build-output';
import { tfBuildOutputSchema } from '@self/shared/lib/operate-env/build-output';
import { computedOpEnvSchema, dynamicOpEnvSchema, scriptOpEnvSchema } from '@self/shared/lib/operate-env/op-env';
import { computedRunScriptEnvSchema, dynamicRunScriptEnvSchema } from '@self/shared/lib/run-script/env';
import { exec } from '@self/shared/lib/util/exec';
import { z } from 'zod';
import { computedBotEnvSchema } from '@self/shared/lib/bot/env';
import { sharedEnvSchema } from '@self/shared/lib/def/env-vars';
import { requireSecrets } from '@self/shared/lib/bot/secrets';
import { createLambdaLogger } from '@self/shared/lib/loggers';

const main = async (): Promise<void> => {
  initEnv();

  const env = scriptOpEnvSchema
    .merge(sharedEnvSchema)
    .merge(computedOpEnvSchema)
    .merge(dynamicOpEnvSchema)
    .merge(computedBotEnvSchema)
    .merge(dynamicRunScriptEnvSchema)
    .merge(computedRunScriptEnvSchema)
    .parse(process.env);

  const credentials = getCodeBuildCredentials();
  // TODO(logging): not lambda
  const logger = createLambdaLogger('operate-env');

  const secrets = await requireSecrets(env, credentials, logger);

  // TODO(hardcoded)
  const botTableRegion = 'ap-northeast-1';
  const entryURL = `https://${botTableRegion}.console.aws.amazon.com/dynamodbv2/home#item-explorer?autoScanAttribute=null&initialTagKey=&table=${env.BOT_TABLE_NAME}`;

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
    const db = new DynamoDB({ credentials });
    // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.UpdateExpressions.html
    await db.updateItem({
      TableName: env.BOT_TABLE_NAME,
      Key: {
        uuid: { S: env.ENTRY_UUID },
      },
      UpdateExpression: `SET ${expr}`,
      ExpressionAttributeNames: keys,
      ExpressionAttributeValues: values,
    });
  };

  const e = async (file: string, args: string[], silent: boolean): Promise<{ stdout: string; stderr: string }> => {
    console.log(`Running ${[file, ...args].map((a) => JSON.stringify(a)).join(' ')}`);
    const { stdout, stderr, exitCode } = await exec(file, args, silent);
    if (exitCode !== 0) {
      if (silent) console.error({ stdout, stderr });
      throw new Error(`exit with ${exitCode}`);
    }
    return { stdout, stderr };
  };

  await updateTable<GeneralBuildOutput>({
    generalBuildOutput: {
      sourceZipKey: env.INFRA_SOURCE_ZIP_KEY,
    },
  });

  const tfOutput = async (name: string): Promise<string> => {
    const output = (
      await exec(
        'terraform',
        ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', 'output', '-no-color', '-raw', `opOutputs-${name}`],
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

  const tfSynthInit = async (): Promise<void> => {
    await e('pnpm', ['--dir', './pkg/def-env', 'run', 'cdktf:synth'], false);
    await e('terraform', ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', 'init', '-no-color'], false);
    // NOTE: https://github.com/hashicorp/terraform/issues/23261
    // https://www.terraform.io/docs/cloud/api/workspaces.html
    await e(
      'curl',
      [
        '--header',
        `Authorization: Bearer ${secrets.TF_ENV_BACKEND_TOKEN}`,
        '--header',
        'Content-Type: application/vnd.api+json',
        '--request',
        'PATCH',
        '--data',
        '{"data":{"type":"workspaces","attributes":{"execution-mode":"local"}}}',
        `https://app.terraform.io/api/v2/organizations/${env.TF_BACKEND_ORGANIZATION}/workspaces/${env.TF_ENV_BACKEND_WORKSPACE}`,
      ],
      false,
    );
  };

  const apiPrismaTaskRun = async (prismaArgs: string[]) => {
    await tfSynthInit();
    const tfBuildOutput = await getTfBuildOutput();

    const ecs = new ECS({ credentials, region: tfBuildOutput.envRegion });
    // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_RunTask.html
    const task = await (async () => {
      const res = await ecs.runTask({
        cluster: tfBuildOutput.ecsClusterName,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: [env.NETWORK_PUB_ID0, env.NETWORK_PUB_ID1, env.NETWORK_PUB_ID2],
            securityGroups: [env.NETWORK_SVC_SG_ID],
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
              command: ['pnpm', '--dir=./pkg/api', 'exec', 'prisma', ...prismaArgs],
              cpu: 256,
              memory: 512,
            },
          ],
        },
      });
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
    await tfSynthInit();
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
        await e(
          'terraform',
          ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', tfCmd, '-no-color', ...tfArgs],
          false,
        );
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

  switch (env.OPERATION) {
    case 'deploy': {
      // NOTE: 削除含む apply で一発では正常に apply できない事がある
      await operate('apply', ['--auto-approve'], 1, 2);
      const tfBuildOutput = await getTfBuildOutput();
      await updateTable<TfBuildOutput>({
        tfBuildOutput,
      });
      break;
    }
    case 'destroy': {
      if (secrets.TF_ENV_BACKEND_TOKEN === 'violet-prodenv-prod') {
        throw new Error(`not allowed to destroy workspace "${secrets.TF_ENV_BACKEND_TOKEN}"`);
      }
      await operate('destroy', ['--auto-approve'], 1, 2);
      const tfBuildOutput = await getTfBuildOutput();
      await e(
        'curl',
        [
          '--header',
          `Authorization: Bearer ${secrets.TF_ENV_BACKEND_TOKEN}`,
          '--header',
          'Content-Type: application/vnd.api+json',
          '--request',
          'DELETE',
          `https://app.terraform.io/api/v2/organizations/${env.TF_BACKEND_ORGANIZATION}/workspaces/${env.TF_ENV_BACKEND_WORKSPACE}`,
        ],
        false,
      );
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
      throw new Error(`not implemented: "${env.OPERATION}"`);
    }
  }

  console.log(`Table: ${entryURL}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
