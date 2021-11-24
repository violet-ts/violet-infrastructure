import { z } from 'zod';

export const issueMapEntrySchema = z.object({
  number: z.number(),
  namespace: z.string().optional(),
  nextBuildSummaryCommentId: z.number().optional(),
});
export type IssueMapEntry = z.infer<typeof issueMapEntrySchema>;
