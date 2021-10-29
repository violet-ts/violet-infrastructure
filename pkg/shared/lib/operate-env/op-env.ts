import { z } from 'zod';
import type { CodeBuildEnv } from '../util/aws-cdk';
import { toCodeBuildEnv } from '../util/aws-cdk';

// 環境変数の受け取り

// script: スクリプトの実行レベルで使う
export const scriptOpEnvSchema = z.object({
  OPERATION: z.union([z.literal('deploy'), z.literal('destroy')]),
});

export type ScriptOpEnv = z.infer<typeof scriptOpEnvSchema>;

// dynamic: 実行時にネームスペースごとに指定する
export const dynamicOpEnvSchema = z.object({
  NAMESPACE: z.string().regex(/[a-z][a-z0-9]*/),
  API_REPO_SHA: z.string(),
});

export type DynamicOpEnv = z.infer<typeof dynamicOpEnvSchema>;

export const botSideOpEnvSchema = scriptOpEnvSchema.merge(dynamicOpEnvSchema);

export type BotSideOpEnv = z.infer<typeof botSideOpEnvSchema>;

// computed: Manager 環境を作ったときに自動で計算して固定して設定する
export const computedOpEnvSchema = z.object({
  CIDR_NUM: z.string(),
  API_REPO_NAME: z.string(),
});

export type ComputedOpEnv = z.infer<typeof computedOpEnvSchema>;

export const opEnvSchema = dynamicOpEnvSchema.merge(computedOpEnvSchema);
export type OpEnv = z.infer<typeof opEnvSchema>;

// 環境変数の入力生成
export const botSideCodeBuildEnv = (env: BotSideOpEnv): CodeBuildEnv => toCodeBuildEnv<BotSideOpEnv>(env);
export const defSideCodeBuildEnv = (env: ComputedOpEnv): CodeBuildEnv => toCodeBuildEnv<ComputedOpEnv>(env);
