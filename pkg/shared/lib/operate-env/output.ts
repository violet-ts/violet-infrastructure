import { z } from 'zod';

export const opOutputSchema = z.object({
  apiTaskDefinitionArn: z.string(),
  apiURL: z.string(),
  webURL: z.string(),
});

export type OpOutput = z.infer<typeof opOutputSchema>;
