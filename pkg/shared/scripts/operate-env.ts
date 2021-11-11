import { Lambda } from '@aws-sdk/client-lambda';
import { getCodeBuildCredentials } from '@self/shared/lib/aws';
import { computedBotEnvSchema } from '@self/shared/lib/bot/env';
import { requireSecrets } from '@self/shared/lib/bot/secrets';
import { sharedEnvSchema } from '@self/shared/lib/def/env-vars';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { createLambdaLogger } from '@self/shared/lib/loggers';
import type {
  GeneralBuildOutput,
  InvokeFunctionBuildOutput,
  TfBuildOutput,
} from '@self/shared/lib/operate-env/build-output';
import { tfBuildOutputSchema } from '@self/shared/lib/operate-env/build-output';
import { computedOpEnvSchema, dynamicOpEnvSchema, scriptOpEnvSchema } from '@self/shared/lib/operate-env/op-env';
import { computedRunScriptEnvSchema, dynamicRunScriptEnvSchema } from '@self/shared/lib/run-script/env';
import { exec } from '@self/shared/lib/util/exec';
import type { OpTfOutput } from '@self/shared/lib/operate-env/output';
import { updateTableRootKeys } from '@self/shared/lib/util/dynamodb';

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

  const updateTable = async <T extends Record<string, Record<string, unknown>>>(outputObj: T) => {
    logger.debug('Updating table.', { outputObj });
    await updateTableRootKeys(
      outputObj,
      env.BOT_TABLE_NAME,
      {
        uuid: { S: env.ENTRY_UUID },
      },
      credentials,
      logger,
    );
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

  const tfSynthInit = async (): Promise<void> => {
    await e('pnpm', ['--dir', './pkg/def-env', 'run', 'cdktf:get'], false);
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

  const ensureTfSynthInit = (() => {
    let run = false;
    return async (): Promise<void> => {
      if (run) return;
      run = true;
      await tfSynthInit();
    };
  })();

  const getTfBuildOutput = async (): Promise<OpTfOutput> => {
    await ensureTfSynthInit();
    const outputJSON = (
      await exec(
        'terraform',
        ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', 'output', '-no-color', '-json', `opOutput`],
        // TODO(security): output
        false,
      )
    ).stdout.trim();
    const output = JSON.parse(outputJSON);
    return tfBuildOutputSchema.shape.tfBuildOutput.unwrap().parse(output);
  };

  const apiExec = async (args: string[]) => {
    const tfBuildOutput = await getTfBuildOutput();

    const lambda = new Lambda({ credentials, logger, region: tfBuildOutput.env_region });
    // TODO(cost): Invoke 待機中の CodeBuild 費用
    const res = await lambda.invoke({
      FunctionName: tfBuildOutput.api_exec_function_name,
      Payload: Uint8Array.from(
        Buffer.from(
          JSON.stringify({
            command: args,
          }),
        ),
      ),
    });

    await updateTable<TfBuildOutput & InvokeFunctionBuildOutput>({
      tfBuildOutput,
      invokeFunctionBuildOutput: {
        executedFunctionName: tfBuildOutput.api_exec_function_name,
        executedVersion: res.ExecutedVersion,
        statusCode: res.StatusCode,
      },
    });
  };

  const apiExecPnpm = async (args: string[]) => {
    await apiExec(['pnpm', '--dir=./pkg/api', ...args]);
  };

  const operate = async (tfCmd: string, tfArgs: string[], minTryCount: number, maxTryCount: number): Promise<void> => {
    await ensureTfSynthInit();
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

  logger.info('operation', { operation: env.OPERATION });

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
      break;
    }
    case 'status': {
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
      await apiExecPnpm(['exec', 'prisma', 'migrate', 'deploy']);
      break;
    }
    case 'prisma/migrate/reset': {
      await apiExecPnpm(['exec', 'prisma', 'migrate', 'reset']);
      break;
    }
    case 'prisma/db/seed': {
      // TODO: other seeds
      await apiExecPnpm(['run', 'prisma:seed', '--', 'dev']);
      break;
    }
    default: {
      throw new Error(`not implemented: "${env.OPERATION}"`);
    }
  }

  console.log(`Table: ${entryURL}`);
};

void main();
