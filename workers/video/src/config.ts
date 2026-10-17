import { z } from 'zod';
import { resolve } from 'node:path';
import { config as loadEnvironment } from 'dotenv';

loadEnvironment({
  path: resolve(import.meta.dirname, '../../../.env'),
});

const booleanString = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

const workerEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  STORAGE_ENDPOINT: z.string().url().default('http://localhost:9000'),
  STORAGE_REGION: z.string().min(1).default('us-east-1'),
  STORAGE_ACCESS_KEY: z.string().min(3).default('lynvado'),
  STORAGE_SECRET_KEY: z
    .string()
    .min(8)
    .default('lynvado-development-storage-secret'),
  STORAGE_BUCKET: z.string().min(3).default('lynvado-media'),
  STORAGE_FORCE_PATH_STYLE: booleanString,
  FFMPEG_PATH: z.string().min(1).default('ffmpeg'),
  FFPROBE_PATH: z.string().min(1).default('ffprobe'),
  VIDEO_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
});

export const workerConfig = workerEnvironmentSchema.parse(process.env);
