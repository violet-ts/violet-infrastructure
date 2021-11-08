import { z } from 'zod';
import type { CodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import { toCodeBuildEnv } from '@self/shared/lib/util/aws-cdk';

// 環境変数の受け取り

// script: スクリプトの実行レベルで使う
export const scriptOpEnvSchema = z.object({
  OPERATION: z.union([
    z.literal('deploy'),
    z.literal('recreate'),
    z.literal('destroy'),
    z.literal('status'),
    z.literal('db/recreate'), // TODO: wip
    z.literal('db/take-snapshot'), // TODO: wip
    z.literal('db/recreate-from'), // TODO: wip
    z.literal('prisma/migrate/deploy'),
    z.literal('prisma/migrate/reset'),
    z.literal('prisma/migrate/status'), // TODO: wip
    z.literal('prisma/db/seed'),
  ]),
});

export type ScriptOpEnv = z.infer<typeof scriptOpEnvSchema>;

export const scriptOpCodeBuildEnv = (env: ScriptOpEnv): CodeBuildEnv =>
  toCodeBuildEnv<ScriptOpEnv>(scriptOpEnvSchema.parse(env));

// dynamic: 実行時にネームスペースごとに指定する
export const dynamicOpEnvSchema = z.object({
  NAMESPACE: z.string(),
  TF_ENV_BACKEND_WORKSAPCE: z.string().regex(/^violet-env-.*/),
  TERRAFORM_VERSION: z.string().regex(/\d+\.\d+\.\d/),

  API_REPO_SHA: z.string(),
  WEB_REPO_SHA: z.string(),
});

export type DynamicOpEnv = z.infer<typeof dynamicOpEnvSchema>;

export const dynamicOpCodeBuildEnv = (env: DynamicOpEnv): CodeBuildEnv =>
  toCodeBuildEnv<DynamicOpEnv>(dynamicOpEnvSchema.parse(env));

// computed: Manager 環境を作ったときに自動で計算して固定して設定する
export const computedOpEnvSchema = z.object({
  API_REPO_NAME: z.string(),
  WEB_REPO_NAME: z.string(),
  NETWORK_VPC_ID: z.string(),
  NETWORK_DB_SG_ID: z.string(),
  NETWORK_LB_SG_ID: z.string(),
  NETWORK_SVC_SG_ID: z.string(),
  NETWORK_PRIV_ID0: z.string(),
  NETWORK_PRIV_ID1: z.string(),
  NETWORK_PRIV_ID2: z.string(),
  NETWORK_PUB_ID0: z.string(),
  NETWORK_PUB_ID1: z.string(),
  NETWORK_PUB_ID2: z.string(),
});

export type ComputedOpEnv = z.infer<typeof computedOpEnvSchema>;

export const computedOpCodeBuildEnv = (env: ComputedOpEnv): CodeBuildEnv =>
  toCodeBuildEnv<ComputedOpEnv>(computedOpEnvSchema.parse(env));
