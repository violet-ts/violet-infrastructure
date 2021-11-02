import { z } from 'zod';
import { requireEnv } from '@self/shared/lib/util/env';

export const sharedEnvSchema = z.object({
  AWS_ACCOUNT_ID: z.string(),
  AWS_PROFILE: z.optional(z.string()),
  /** 事前に作成した AWS Route53 Zone */
  PREVIEW_ZONE_ID: z.string(),
  DOCKERHUB: z.optional(
    z.object({
      USER: z.string(),
      PASS: z.string(),
    }),
  ),
  INFRA_GIT_URL: z.string(),
  INFRA_GIT_FETCH: z.string(),
});

// ローカルからのみ与えることが可能
export type SharedEnv = z.infer<typeof sharedEnvSchema>;
export const requireSharedEnvVars = (): SharedEnv => {
  const { AWS_PROFILE, DOCKERHUB_USER, DOCKERHUB_PASS } = process.env;
  const { AWS_ACCOUNT_ID } = requireEnv('AWS_ACCOUNT_ID');
  const { INFRA_GIT_URL } = requireEnv('INFRA_GIT_URL');
  const { INFRA_GIT_FETCH } = requireEnv('INFRA_GIT_FETCH');
  if ((typeof DOCKERHUB_USER !== 'string') !== (typeof DOCKERHUB_PASS !== 'string'))
    throw new Error('both DOCKERHUB_USER and DOCKERHUB_PASS should either exist or be absent');
  const DOCKERHUB =
    typeof DOCKERHUB_USER === 'string' && typeof DOCKERHUB_PASS === 'string'
      ? { USER: DOCKERHUB_USER, PASS: DOCKERHUB_PASS }
      : undefined;
  const { PREVIEW_ZONE_ID } = requireEnv('PREVIEW_ZONE_ID');

  return {
    AWS_ACCOUNT_ID,
    AWS_PROFILE,
    PREVIEW_ZONE_ID,
    DOCKERHUB,
    INFRA_GIT_URL,
    INFRA_GIT_FETCH,
  };
};

export const managerEnvSchema = z.object({
  CIDR_NUM: z.string().regex(/[0-9]+/),
});
export type ManagerEnv = z.infer<typeof managerEnvSchema>;
