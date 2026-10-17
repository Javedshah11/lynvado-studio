import { z } from 'zod';

export const allowedVideoMimeTypes = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
] as const;

export const initializeUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(allowedVideoMimeTypes),
  sizeBytes: z.number().int().positive(),
});

export const completeUploadSchema = z.object({
  uploadId: z.string().uuid(),
});

export type InitializeUploadInput = z.infer<typeof initializeUploadSchema>;
