import { z } from 'zod';

/**
 * Terraform Output として env stack から出す値
 */
export const opTfOutputSchema = z.object({
  apiTaskDefinitionArn: z.string(),
  apiURL: z.string(),
  webURL: z.string(),
  envRegion: z.string(),
  ecsClusterName: z.string(),
  apiTaskLogGroupName: z.string(),
  webTaskLogGroupName: z.string(),
  conv2imgFunctionName: z.string(),
  apiExecFunctionName: z.string(),
});

export type OpTfOutput = z.infer<typeof opTfOutputSchema>;
