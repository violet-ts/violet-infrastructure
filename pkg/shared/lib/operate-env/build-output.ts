import { z } from 'zod';

export const generalBuildOutputSchema = z.object({
  generalBuildOutput: z.optional(
    z.object({
      rev: z.string(),
    }),
  ),
});
export type GeneralBuildOutput = z.infer<typeof generalBuildOutputSchema>;

export const tfBuildOutputSchema = z.object({
  tfBuildOutput: z.optional(
    z.object({
      envRegion: z.string(),
      apiTaskDefinitionArn: z.string(),
      apiURL: z.string(),
      webURL: z.string(),
      ecsClusterRegion: z.string(),
      ecsClusterName: z.string(),
      apiTaskLogGroupName: z.string(),
      webTaskLogGroupName: z.string(),
    }),
  ),
});
export type TfBuildOutput = z.infer<typeof tfBuildOutputSchema>;

export const runTaskBuildOutputSchema = z.object({
  runTaskBuildOutput: z.optional(
    z.object({
      taskArn: z.string(),
    }),
  ),
});
export type RunTaskBuildOutput = z.infer<typeof runTaskBuildOutputSchema>;

export type BuiltInfo = { timeRange: string };
