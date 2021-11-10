import { App } from 'cdktf';
import { configureEnvBackend } from '@self/shared/lib/def/util/backend';
import { initEnv } from '@self/shared/lib/def/util/init-env';
import { computedOpEnvSchema, dynamicOpEnvSchema } from '@self/shared/lib/operate-env/op-env';
import { sharedEnvSchema } from '@self/shared/lib/def/env-vars';
import { computedRunScriptEnvSchema, dynamicRunScriptEnvSchema } from '@self/shared/lib/run-script/env';
import { createLambdaLogger } from '@self/shared/lib/loggers';
import { codeBuildStackEnvSchema } from '@self/shared/lib/codebuild-stack/env';
import { requireSecrets } from '@self/shared/lib/bot/secrets';
import { computedBotEnvSchema } from '@self/shared/lib/bot/env';
import { getCodeBuildCredentials } from '@self/shared/lib/aws';
import type { VioletEnvOptions } from './stack';
import { VioletEnvStack } from './stack';

const main = async () => {
  initEnv();

  const sharedEnv = sharedEnvSchema.parse(process.env);
  const dynamicOpEnv = dynamicOpEnvSchema.parse(process.env);
  const computedOpEnv = computedOpEnvSchema.parse(process.env);
  const computedBotEnv = computedBotEnvSchema.parse(process.env);
  const dynamicRunScriptEnv = dynamicRunScriptEnvSchema.parse(process.env);
  const computedRunScriptEnv = computedRunScriptEnvSchema.parse(process.env);
  const codeBuildStackEnv = codeBuildStackEnvSchema.parse(process.env);

  const credentials = getCodeBuildCredentials();
  // TODO: not lambda
  const logger = createLambdaLogger('update-pr-labels');
  const secrets = await requireSecrets(computedBotEnv, credentials, logger);

  const options: VioletEnvOptions = {
    // TODO(hardcoded)
    region: 'ap-northeast-1',

    sharedEnv,
    dynamicOpEnv,
    computedOpEnv,
    computedBotEnv,
    dynamicRunScriptEnv,
    computedRunScriptEnv,
    codeBuildStackEnv,

    // TODO(hardcoded)
    section: 'development',
  };

  const app = new App();
  const stack = new VioletEnvStack(app, 'violet-infra', options);
  configureEnvBackend(stack, dynamicOpEnv.TF_ENV_BACKEND_WORKSPACE, sharedEnv, secrets);
  app.synth();
};

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console -- entrypoint
  console.error(err);
  process.exit(1);
});
