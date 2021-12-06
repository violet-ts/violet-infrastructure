import { lighthouseCategories } from '@self/shared/lib/const/lighthouse';
import { z } from 'zod';
import { opTfOutputSchema } from './output';

export const generalBuildOutputSchema = z.object({
  generalBuildOutput: z.optional(
    z.object({
      buildId: z.string(),
      sourceZipBucket: z.string(),
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

export const invokeFunctionBuildOutputSchema = z.object({
  invokeFunctionBuildOutput: z.optional(
    z.object({
      executedFunctionName: z.string(),
      executedVersion: z.string().optional(),
      statusCode: z.number().optional(),
    }),
  ),
});
export type InvokeFunctionBuildOutput = z.infer<typeof invokeFunctionBuildOutputSchema>;

export const lighthouseBuildOutputSchema = z.object({
  lighthouseBuildOutput: z.optional(
    z.object({
      origin: z.string(),
      paths: z
        .object({
          path: z.string(),
          url: z.string(),
          mode: z.union([z.literal('mobile'), z.literal('desktop')]),
          s3Folder: z.string(),
          scores: z.object({
            [lighthouseCategories[0]]: z.number().nullish(),
            [lighthouseCategories[1]]: z.number().nullish(),
            [lighthouseCategories[2]]: z.number().nullish(),
            [lighthouseCategories[3]]: z.number().nullish(),
          }),
          // https://github.com/GoogleChrome/lighthouse/blob/a6bcbf268db1053c24430a2f39d2e8afc9d4719f/types/lhr/treemap.d.ts#L11-L22
          lhrTreemapJson: z
            .object({
              lhr: z.object({
                requestedUrl: z.string(),
                finalUrl: z.string(),
                audits: z
                  .object({
                    'script-treemap-data': z.unknown(),
                  })
                  .strip(),
                configSettings: z
                  .object({
                    locale: z.unknown(),
                  })
                  .strip(),
              }),
            })
            .strip(),
        })
        .array(),
    }),
  ),
});
export type LighthouseBuildOutput = z.infer<typeof lighthouseBuildOutputSchema>;
