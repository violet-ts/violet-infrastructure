import { z } from 'zod';
import { toCodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import type { CodeBuildEnv } from '@self/shared/lib/util/aws-cdk';

const dockerHubCredSchema = z.object({
  USER: z.string(),
  PASS: z.string(),
});
export type DockerHubCred = z.infer<typeof dockerHubCredSchema>;
export const extractDockerHubCred = (from: Record<string, string | undefined>): DockerHubCred | undefined => {
  const { DOCKERHUB_USER, DOCKERHUB_PASS } = from;
  if ((typeof DOCKERHUB_USER !== 'string') !== (typeof DOCKERHUB_PASS !== 'string'))
    throw new Error('both DOCKERHUB_USER and DOCKERHUB_PASS should either exist or be absent');
  const dockerHubCred =
    typeof DOCKERHUB_USER === 'string' && typeof DOCKERHUB_PASS === 'string'
      ? { USER: DOCKERHUB_USER, PASS: DOCKERHUB_PASS }
      : undefined;

  return dockerHubCred;
};

export const sharedEnvSchema = z.object({
  MANAGER_NAMESPACE: z.union([z.literal('prod'), z.string().regex(/^dev-[\w-]*/)]),
  AWS_ACCOUNT_ID: z.string(),
  /** 事前に作成した AWS Route53 Zone */
  PREVIEW_ZONE_ID: z.string(),
  TF_BACKEND_ORGANIZATION: z.string(),
});
// ローカルからのみ与えることが可能
export type SharedEnv = z.infer<typeof sharedEnvSchema>;
export const sharedCodeBuildEnv = (env: SharedEnv): CodeBuildEnv =>
  toCodeBuildEnv<SharedEnv>(sharedEnvSchema.parse(env));

export const managerEnvSchema = z.object({
  CIDR_NUM: z.string().regex(/[0-9]+/),
});
export type ManagerEnv = z.infer<typeof managerEnvSchema>;
