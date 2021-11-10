import { z } from 'zod';
import { opTfOutputSchema } from './output';

export const generalBuildOutputSchema = z.object({
  generalBuildOutput: z.optional(
    z.object({
      sourceZipKey: z.string(),
    }),
  ),
});
export type GeneralBuildOutput = z.infer<typeof generalBuildOutputSchema>;

export const tfBuildOutputSchema = z.object({
  tfBuildOutput: z.optional(opTfOutputSchema),
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

export const invokeFunctionBuildOutputSchema = z.object({
  invokeFunctionBuildOutput: z.optional(
    z.object({
      executedFunctionName: z.string(),
      executedVersion: z.optional(z.string()),
      statusCode: z.optional(z.number()),
    }),
  ),
});
export type InvokeFunctionBuildOutput = z.infer<typeof invokeFunctionBuildOutputSchema>;
