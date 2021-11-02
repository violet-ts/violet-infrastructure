import { z } from 'zod';

/**
 * Terraform Output として env stack から出す値
 */
export const opTfOutputSchema = z.object({
  apiTaskDefinitionArn: z.string(),
  apiURL: z.string(),
  webURL: z.string(),
  ecsClusterRegion: z.string(),
  ecsClusterName: z.string(),
});

export type OpTfOutput = z.infer<typeof opTfOutputSchema>;
