import { Lambda } from '@aws-sdk/client-lambda';
import { getCodeBuildCredentials } from '@self/shared/lib/aws';
import { computedBotEnvSchema } from '@self/shared/lib/bot/env';
import { requireSecrets } from '@self/shared/lib/bot/secrets';
import { setupCachedChrome } from '@self/shared/lib/chrome/setup';
import { codeBuildStackEnvSchema } from '@self/shared/lib/codebuild-stack/env';
import { codeBuildEnvSchema } from '@self/shared/lib/codebuild/env';
import { lighthouseCategories, lighthouseNames } from '@self/shared/lib/const/lighthouse';
import { sharedEnvSchema } from '@self/shared/lib/def/env-vars';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { createLambdaLogger } from '@self/shared/lib/loggers';
import type { LighthouseBuildOutput } from '@self/shared/lib/operate-env/build-output';
import {
  generalBuildOutputSchema,
  invokeFunctionBuildOutputSchema,
  lighthouseBuildOutputSchema,
  tfBuildOutputSchema,
} from '@self/shared/lib/operate-env/build-output';
import { computedOpEnvSchema, dynamicOpEnvSchema, scriptOpEnvSchema } from '@self/shared/lib/operate-env/op-env';
import type { OpTfOutput } from '@self/shared/lib/operate-env/output';
import { computedRunScriptEnvSchema, dynamicRunScriptEnvSchema } from '@self/shared/lib/run-script/env';
import { updateTableRootKeys } from '@self/shared/lib/util/dynamodb';
import { exec, execThrow } from '@self/shared/lib/util/exec';
import { createTmpdirContext } from '@self/shared/lib/util/tmpdir';
import { asyncIter } from 'ballvalve';
import * as chromeLauncher from 'chrome-launcher';
import * as fs from 'fs';
import type { LighthouseOptions } from 'lighthouse';
import lighthouse from 'lighthouse';
import lighthouseDesktopConfig from 'lighthouse/lighthouse-core/config/desktop-config';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';

type LighthousePathResult = Required<LighthouseBuildOutput>['lighthouseBuildOutput']['paths'][number];

const main = async (): Promise<void> => {
  initEnv();

  const violetInfraArtifactsDir = path.resolve(os.homedir(), 'violet-infra-artifacts');

  const env = codeBuildEnvSchema
    .merge(codeBuildStackEnvSchema)
    .merge(scriptOpEnvSchema)
    .merge(sharedEnvSchema)
    .merge(computedOpEnvSchema)
    .merge(dynamicOpEnvSchema)
    .merge(computedBotEnvSchema)
    .merge(dynamicRunScriptEnvSchema)
    .merge(computedRunScriptEnvSchema)
    .parse(process.env);

  const args: readonly string[] = z
    .string()
    .array()
    .parse(JSON.parse(env.RUN_SCRIPT_ARGS ?? '[]'));

  const credentials = getCodeBuildCredentials();
  // TODO(logging): not lambda
  const logger = createLambdaLogger('operate-env');

  const secrets = await requireSecrets(env, credentials, logger);

  // TODO(hardcoded)
  const botTableRegion = 'ap-northeast-1';
  const entryURL = `https://${botTableRegion}.console.aws.amazon.com/dynamodbv2/home#item-explorer?autoScanAttribute=null&initialTagKey=&table=${env.BOT_TABLE_NAME}`;

  const delay = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const updateTable = async <T extends Record<string, Record<string, unknown>>>(
    schema: z.ZodSchema<T>,
    outputObj: T,
  ) => {
    await updateTableRootKeys(
      schema.parse(outputObj),
      env.BOT_TABLE_NAME,
      {
        uuid: { S: env.ENTRY_UUID },
      },
      credentials,
      logger,
    );
  };

  await updateTable(generalBuildOutputSchema, {
    generalBuildOutput: {
      buildId: env.CODEBUILD_BUILD_ID,
      sourceZipBucket: env.INFRA_SOURCE_BUCKET,
      sourceZipKey: env.INFRA_SOURCE_ZIP_KEY,
    },
  });

  const tfSynthInit = async (): Promise<void> => {
    await execThrow('pnpm', ['--dir', './pkg/def-env', 'run', 'cdktf:get'], false);
    await execThrow('pnpm', ['--dir', './pkg/def-env', 'run', 'cdktf:synth'], false);
    await execThrow('terraform', ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', 'init', '-no-color'], false);
    // NOTE: https://github.com/hashicorp/terraform/issues/23261
    // https://www.terraform.io/docs/cloud/api/workspaces.html
    await execThrow(
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
        ['-chdir=./pkg/def-env/cdktf.out/stacks/violet-infra', 'output', '-no-color', '-json', 'opOutput'],
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

    await updateTable(tfBuildOutputSchema.merge(invokeFunctionBuildOutputSchema), {
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
        await execThrow(
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
      await updateTable(tfBuildOutputSchema, {
        tfBuildOutput,
      });
      break;
    }
    case 'destroy': {
      if (secrets.TF_ENV_BACKEND_TOKEN === 'violet-prodenv-prod') {
        throw new Error(`not allowed to destroy workspace "${secrets.TF_ENV_BACKEND_TOKEN}"`);
      }
      await operate('destroy', ['--auto-approve'], 1, 2);
      await execThrow(
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
      await updateTable(tfBuildOutputSchema, {
        tfBuildOutput,
      });
      break;
    }
    case 'recreate': {
      await operate('destroy', ['--auto-approve'], 1, 2);
      await operate('apply', ['--auto-approve'], 1, 2);
      const tfBuildOutput = await getTfBuildOutput();
      await updateTable(tfBuildOutputSchema, {
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
      const seedNames = args.length ? [...args] : ['dev'];
      for (const seedName of seedNames) {
        await apiExecPnpm(['run', '_:prisma:seed', '--', seedName]);
      }
      break;
    }
    case 'lighthouse': {
      const tfBuildOutput = await getTfBuildOutput();
      await fs.promises.mkdir(violetInfraArtifactsDir, { recursive: true });
      const chromePath = await setupCachedChrome();
      const targetPaths = args.length ? [...args] : [''];
      const targetOrigin = tfBuildOutput.web_url;

      const paths = await asyncIter(targetPaths)
        .flatMap((targetPath) =>
          asyncIter([
            [targetPath, 'mobile'],
            [targetPath, 'desktop'],
          ] as const),
        )
        .enumerate()
        .map(async ([i, [targetPath, mode]]): Promise<LighthousePathResult> => {
          const userDataDirCtx = createTmpdirContext();
          const userDataDir = userDataDirCtx.open();
          try {
            logger.info('Starting Chrome...');
            const chrome = await chromeLauncher.launch({
              chromeFlags: ['--headless', '--no-sandbox'],
              chromePath,
              userDataDir,
            });
            try {
              logger.info(`Chrome started on port ${chrome.port}`, { port: chrome.port });
              const desktop = mode === 'desktop';
              const options: LighthouseOptions = {
                logLevel: 'info',
                output: ['html'],
                onlyCategories: [...lighthouseCategories],
                formFactor: desktop ? 'desktop' : 'mobile',
                port: chrome.port,
                // TODO(hardcoded): locale
                locale: 'ja',
              };
              const targetUrl = `${targetOrigin}${targetPath}`;
              const urlReference = targetUrl.replace(/[\P{L}\s/!@#$%^&*()+|~`\\='";:[\]{}<>,.?-]/gu, '_');
              const runnerResult = await lighthouse(targetUrl, options, desktop ? lighthouseDesktopConfig : undefined);

              const reportHtml = typeof runnerResult.report === 'string' ? [runnerResult.report] : runnerResult.report;

              if (reportHtml.length !== 1) throw new Error('report HTML length is not 1');

              const s3Folder = `${i}-${mode}-${urlReference}`;
              const dir = path.resolve(violetInfraArtifactsDir, s3Folder);

              await fs.promises.mkdir(dir, { recursive: true });
              await fs.promises.writeFile(path.resolve(dir, lighthouseNames.html), reportHtml[0]);
              await fs.promises.writeFile(path.resolve(dir, lighthouseNames.json), JSON.stringify(runnerResult));

              return {
                path: targetPath,
                url: targetUrl,
                mode,
                scores: {
                  performance: runnerResult.lhr.categories.performance.score,
                  'best-practices': runnerResult.lhr.categories['best-practices'].score,
                  accessibility: runnerResult.lhr.categories.accessibility.score,
                  seo: runnerResult.lhr.categories.seo.score,
                },
                s3Folder,
                lhrTreemapJson: runnerResult,
              };
            } finally {
              await chrome.kill();
            }
          } finally {
            userDataDirCtx.close();
          }
        })
        .collect();

      const profileArgs = process.env.AWS_PROFILE ? ['--profile', process.env.AWS_PROFILE] : [];
      await execThrow(
        'aws',
        [
          ...profileArgs,
          's3',
          'sync',
          violetInfraArtifactsDir,
          `s3://${env.BUILD_ARTIFACT_BUCKET}/${env.CODEBUILD_BUILD_ID}`,
          '--acl',
          'public-read',
        ],
        false,
      );

      await updateTable(lighthouseBuildOutputSchema, {
        lighthouseBuildOutput: {
          origin: targetOrigin,
          paths,
        },
      });
      break;
    }
    default: {
      throw new Error(`not implemented: "${env.OPERATION}"`);
    }
  }

  console.log(`Table: ${entryURL}`);
};

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
