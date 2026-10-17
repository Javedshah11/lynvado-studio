import { resolve } from 'node:path';

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as schema from '@lynvado/database';
import {
  captionSegments,
  captionTracks,
  clipSuggestions,
  processingJobs,
  projects,
  transcriptSegments,
  transcripts,
} from '@lynvado/database';
import { Job, Worker } from 'bullmq';
import { config as loadEnvironment } from 'dotenv';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { z } from 'zod';

import { generateClipSuggestions } from './clip-suggestions.js';

loadEnvironment({ path: resolve(import.meta.dirname, '../../../.env') });

const environment = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  INTELLIGENCE_URL: z.string().url().default('http://localhost:8000'),
  STORAGE_ENDPOINT: z.string().url().default('http://localhost:9000'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_ACCESS_KEY: z.string().default('lynvado'),
  STORAGE_SECRET_KEY: z.string().default('lynvado-development-storage-secret'),
  STORAGE_BUCKET: z.string().default('lynvado-media'),
  STORAGE_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  TRANSCRIPTION_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
}).parse(process.env);

const responseSchema = z.object({
  language: z.string().nullable(),
  language_probability: z.number().nullable(),
  duration_ms: z.number().int().nonnegative(),
  segments: z.array(z.object({
    start_ms: z.number().int().nonnegative(),
    end_ms: z.number().int().nonnegative(),
    text: z.string().min(1),
    confidence: z.number().min(0).max(1).nullable(),
  })),
});

interface TranscriptionJobPayload {
  processingJobId: string;
  projectId: string;
  mediaAssetId: string;
  storageKey: string;
}

const pool = new Pool({ connectionString: environment.DATABASE_URL });
const db = drizzle({ client: pool, schema });
const redis = new Redis(environment.REDIS_URL, { maxRetriesPerRequest: null });
const storage = new S3Client({
  endpoint: environment.STORAGE_ENDPOINT,
  region: environment.STORAGE_REGION,
  forcePathStyle: environment.STORAGE_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: environment.STORAGE_ACCESS_KEY,
    secretAccessKey: environment.STORAGE_SECRET_KEY,
  },
});

const worker = new Worker<TranscriptionJobPayload>(
  'media-transcription',
  async (job: Job<TranscriptionJobPayload>) => {
    const payload = job.data;
    try {
      const [scopedJob] = await db.select({ id: processingJobs.id }).from(processingJobs).where(and(
        eq(processingJobs.id, payload.processingJobId),
        eq(processingJobs.projectId, payload.projectId),
        eq(processingJobs.mediaAssetId, payload.mediaAssetId),
        eq(processingJobs.type, 'transcription'),
      )).limit(1);
      if (!scopedJob) throw new Error('Transcription job scope is invalid.');
      await updateJob(payload.processingJobId, 'processing', 10, null);
      await job.updateProgress(10);

      const object = await storage.send(new GetObjectCommand({
        Bucket: environment.STORAGE_BUCKET,
        Key: payload.storageKey,
      }));
      if (!object.Body) throw new Error('Normalized audio object has no body.');
      const bytes = await object.Body.transformToByteArray();

      await updateJob(payload.processingJobId, 'processing', 30, null);
      await job.updateProgress(30);
      const form = new FormData();
      const audioBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(audioBuffer).set(bytes);
      form.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');
      const response = await fetch(`${environment.INTELLIGENCE_URL}/v1/transcriptions`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(60 * 60 * 1000),
      });
      if (!response.ok) {
        throw new Error(`Intelligence service returned ${response.status}: ${await response.text()}`);
      }
      const result = responseSchema.parse(await response.json());

      await updateJob(payload.processingJobId, 'processing', 80, null);
      await job.updateProgress(80);
      await db.transaction(async (tx) => {
        const [transcript] = await tx
          .insert(transcripts)
          .values({
            projectId: payload.projectId,
            mediaAssetId: payload.mediaAssetId,
            language: result.language,
            status: 'completed',
          })
          .onConflictDoUpdate({
            target: transcripts.mediaAssetId,
            set: {
              language: result.language,
              status: 'completed',
              updatedAt: new Date(),
            },
          })
          .returning();
        if (!transcript) throw new Error('Failed to persist transcript.');

        await tx
          .delete(transcriptSegments)
          .where(eq(transcriptSegments.transcriptId, transcript.id));
        if (result.segments.length > 0) {
          await tx.insert(transcriptSegments).values(
            result.segments.map((segment, position) => ({
              transcriptId: transcript.id,
              position,
              startMs: segment.start_ms,
              endMs: segment.end_ms,
              text: segment.text,
              confidence: segment.confidence,
            })),
          );
        }

        const [captionTrack] = await tx
          .insert(captionTracks)
          .values({
            projectId: payload.projectId,
            transcriptId: transcript.id,
            language: result.language,
            style: {
              fontFamily: 'Inter',
              fontSize: 48,
              color: '#FFFFFF',
              backgroundColor: '#000000B3',
              position: 'bottom',
            },
          })
          .onConflictDoUpdate({
            target: captionTracks.transcriptId,
            set: {
              language: result.language,
              updatedAt: new Date(),
            },
          })
          .returning();
        if (!captionTrack) throw new Error('Failed to persist caption track.');

        await tx
          .delete(captionSegments)
          .where(eq(captionSegments.trackId, captionTrack.id));
        if (result.segments.length > 0) {
          await tx.insert(captionSegments).values(
            result.segments.map((segment, position) => ({
              trackId: captionTrack.id,
              position,
              startMs: segment.start_ms,
              endMs: segment.end_ms,
              text: segment.text,
            })),
          );
        }

        const suggestions = generateClipSuggestions(result.segments);
        for (const suggestion of suggestions) {
          await tx
            .insert(clipSuggestions)
            .values({
              projectId: payload.projectId,
              transcriptId: transcript.id,
              ...suggestion,
            })
            .onConflictDoUpdate({
              target: [
                clipSuggestions.transcriptId,
                clipSuggestions.startMs,
                clipSuggestions.endMs,
              ],
              set: {
                title: suggestion.title,
                score: suggestion.score,
                reason: suggestion.reason,
                signals: suggestion.signals,
                updatedAt: new Date(),
              },
            });
        }

        await tx
          .update(processingJobs)
          .set({
            status: 'completed',
            progress: 100,
            error: null,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(processingJobs.id, payload.processingJobId),
              eq(processingJobs.mediaAssetId, payload.mediaAssetId),
            ),
          );
        await tx
          .update(projects)
          .set({ status: 'ready', updatedAt: new Date() })
          .where(eq(projects.id, payload.projectId));
      });
      await job.updateProgress(100);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown transcription failure.';
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await updateJob(payload.processingJobId, finalAttempt ? 'failed' : 'queued', 0, message.slice(0, 4000));
      if (finalAttempt) {
        await db
          .update(projects)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(projects.id, payload.projectId));
      }
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: environment.TRANSCRIPTION_WORKER_CONCURRENCY,
  },
);

async function updateJob(
  id: string,
  status: 'queued' | 'processing' | 'failed',
  progress: number,
  error: string | null,
): Promise<void> {
  await db
    .update(processingJobs)
    .set({
      status,
      progress,
      error,
      startedAt: status === 'processing' ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(processingJobs.id, id));
}

worker.on('ready', () => console.log('Lynvado transcription worker is ready.'));
worker.on('completed', (job) => console.log(`Completed transcription job ${job.id}.`));
worker.on('failed', (job, error) => console.error(`Transcription job ${job?.id ?? 'unknown'} failed.`, error));

async function shutdown(): Promise<void> {
  await worker.close();
  await redis.quit();
  await pool.end();
}

process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));
