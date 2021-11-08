import { z } from 'zod';

export const issueMapEntrySchema = z.object({
  number: z.number(),
  namespace: z.optional(z.string()),
});
export type IssueMapEntry = z.infer<typeof issueMapEntrySchema>;
