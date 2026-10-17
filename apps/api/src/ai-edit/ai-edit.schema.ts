import { z } from 'zod';

export const aiEditRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  style: z.enum(['auto', 'highlights', 'social', 'clean']),
  expectedVersion: z.number().int().positive().nullable(),
});

export const ollamaEditSchema = z.object({
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']),
  captionEnabled: z.boolean(),
  selections: z.array(z.object({
    startIndex: z.number().int().nonnegative(),
    endIndex: z.number().int().nonnegative(),
  })).min(1).max(20),
  explanation: z.string().max(1000),
});

export type AiEditRequest = z.infer<typeof aiEditRequestSchema>;
