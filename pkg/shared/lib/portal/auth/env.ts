import { z } from 'zod';

export const createAuthChallengeEnvSchema = z.object({
  SES_FROM_ADDRESS: z.string(),
});
export type CreateAuthChallengeEnv = z.infer<typeof createAuthChallengeEnvSchema>;
