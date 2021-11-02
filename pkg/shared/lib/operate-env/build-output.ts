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
      apiURL: z.string(),
      webURL: z.string(),
      ecsClusterRegion: z.string(),
      ecsClusterName: z.string(),
    }),
  ),
});
export type TfBuildOutput = z.infer<typeof tfBuildOutputSchema>;

export type BuiltInfo = { timeRange: string };
