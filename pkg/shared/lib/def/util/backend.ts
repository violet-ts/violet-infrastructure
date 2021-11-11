// Reference: https://github.com/hashicorp/terraform-cdk/blob/main/docs/working-with-cdk-for-terraform/remote-backend.md

import type { BotSecrets } from '@self/shared/lib/bot/env';
import type { SharedEnv } from '@self/shared/lib/def/env-vars';
import type { TerraformStack } from 'cdktf';
import { RemoteBackend } from 'cdktf';

/**
 * @param uniqueName 仮に stack が複数の設定で同時に生成されうるとしても競合しない名前
 */
export const configureManagerBackend = (stack: TerraformStack, uniqueName: string, sharedEnv: SharedEnv): void => {
  const backend = new RemoteBackend(stack, {
    organization: sharedEnv.TF_BACKEND_ORGANIZATION,
    workspaces: {
      name: uniqueName,
    },
  });
  void backend;
};

/**
 * @param uniqueName 仮に stack が複数の設定で同時に生成されうるとしても競合しない名前
 */
export const configureEnvBackend = (
  stack: TerraformStack,
  uniqueName: string,
  sharedEnv: SharedEnv,
  botSecrets: BotSecrets,
): void => {
  const backend = new RemoteBackend(stack, {
    organization: sharedEnv.TF_BACKEND_ORGANIZATION,
    workspaces: {
      name: uniqueName,
    },
    token: botSecrets.TF_ENV_BACKEND_TOKEN,
  });
  void backend;
};
