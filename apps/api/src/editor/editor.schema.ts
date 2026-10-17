import { z } from 'zod';

const clipSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string().uuid(),
  inMs: z.number().int().nonnegative(),
  outMs: z.number().int().positive(),
}).refine((clip) => clip.outMs > clip.inMs, { message: 'Clip out point must follow its in point.' });

const captionSchema = z.object({
  id: z.string().uuid(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  text: z.string().max(500),
}).refine((caption) => caption.endMs > caption.startMs, { message: 'Caption end must follow its start.' });

export const saveTimelineSchema = z.object({
  expectedVersion: z.number().int().positive().nullable(),
  timeline: z.object({
    schemaVersion: z.literal(1),
    aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']),
    videoTrack: z.object({ clips: z.array(clipSchema).max(500) }),
    captionTrack: z.object({ enabled: z.boolean(), items: z.array(captionSchema).max(5000) }),
  }),
});

export type SaveTimelineInput = z.infer<typeof saveTimelineSchema>;
