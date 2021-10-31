import { z } from 'zod';

export const outputBuiltInfoSchema = z.object({
  rev: z.string(),
});
export type OutputBuiltInfo = z.infer<typeof outputBuiltInfoSchema>;
export type BuiltInfo = OutputBuiltInfo & { timeRange: string };
