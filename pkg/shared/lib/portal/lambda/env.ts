import { z } from 'zod';

export const portalEnvSchema = z.object({
  PORTAL_TABLE_NAME: z.string(),
  PORTAL_USER_POOL_ID: z.string(),
  PORTAL_USER_POOL_WEB_CLIENT_ID: z.string(),
  PORTAL_IAM_DEV_GROUP: z.string(),
});
export type PortalEnv = z.infer<typeof portalEnvSchema>;
