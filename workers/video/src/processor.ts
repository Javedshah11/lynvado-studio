import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  mediaAssets,
  processingJobs,
  projects,
} from '@lynvado/database';
import * as databaseSchema from '@lynvado/database';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  createNormalizedAudio,
  createProxy,
  createThumbnail,
  probeMedia,
} from './media-tools.js';
import { downloadObject, uploadObject } from './storage.js';

export interface IngestionJobPayload {
  processingJobId: string;
  projectId: string;
  mediaAssetId: string;
  storageKey: string;
}

type Database = NodePgDatabase<typeof databaseSchema>;

export async function processIngestion(
  db: Database,
  payload: IngestionJobPayload,
  updateProgress: (progress: number) => Promise<void>,
  enqueueTranscription: (payload: {
    processingJobId: string;
    projectId: string;
    mediaAssetId: string;
    storageKey: string;
  }) => Promise<void>,
  finalAttempt = true,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'lynvado-video-'));
  const inputPath = join(directory, 'original');
  const proxyPath = join(directory, 'proxy.mp4');
  const thumbnailPath = join(directory, 'thumbnail.jpg');
  const audioPath = join(directory, 'audio.wav');

  try {
    const [scopedAsset] = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(
      eq(mediaAssets.id, payload.mediaAssetId),
      eq(mediaAssets.projectId, payload.projectId),
      eq(mediaAssets.storageKey, payload.storageKey),
    )).limit(1);
    const [scopedJob] = await db.select({ id: processingJobs.id }).from(processingJobs).where(and(
      eq(processingJobs.id, payload.processingJobId),
      eq(processingJobs.projectId, payload.projectId),
      eq(processingJobs.mediaAssetId, payload.mediaAssetId),
      eq(processingJobs.type, 'ingestion'),
    )).limit(1);
    if (!scopedAsset || !scopedJob) throw new Error('Ingestion job scope is invalid.');
    await markProcessing(db, payload.processingJobId, 5);
    await updateProgress(5);
    await downloadObject(payload.storageKey, inputPath);

    const metadata = await probeMedia(inputPath);
    await markProcessing(db, payload.processingJobId, 20);
    await updateProgress(20);

    await createProxy(inputPath, proxyPath);
    await markProcessing(db, payload.processingJobId, 50);
    await updateProgress(50);

    await createThumbnail(inputPath, thumbnailPath, metadata.durationMs);
    await markProcessing(db, payload.processingJobId, 65);
    await updateProgress(65);

    await createNormalizedAudio(inputPath, audioPath, metadata.hasAudio);
    await markProcessing(db, payload.processingJobId, 80);
    await updateProgress(80);

    const prefix = payload.storageKey.replace(/\/originals\/[^/]+$/, '/derived');
    const proxyKey = `${prefix}/proxy.mp4`;
    const thumbnailKey = `${prefix}/thumbnail.jpg`;
    const audioKey = `${prefix}/audio.wav`;
    const [proxy, thumbnail, audio] = await Promise.all([
      uploadObject(proxyKey, proxyPath, 'video/mp4'),
      uploadObject(thumbnailKey, thumbnailPath, 'image/jpeg'),
      uploadObject(audioKey, audioPath, 'audio/wav'),
    ]);

    await updateProgress(90);
    const transcriptionPayload = await db.transaction(async (tx) => {
      await tx
        .update(mediaAssets)
        .set({
          durationMs: metadata.durationMs,
          width: metadata.width,
          height: metadata.height,
        })
        .where(eq(mediaAssets.id, payload.mediaAssetId));

      const audioAsset = await upsertDerivedAsset(tx, {
        projectId: payload.projectId,
        kind: 'proxy',
        storageKey: proxyKey,
        mimeType: 'video/mp4',
        sizeBytes: proxy.sizeBytes,
        etag: proxy.etag,
        durationMs: metadata.durationMs,
      });

      const [transcriptionJob] = await tx
        .insert(processingJobs)
        .values({
          projectId: payload.projectId,
          mediaAssetId: audioAsset.id,
          type: 'transcription',
          status: 'queued',
        })
        .onConflictDoUpdate({
          target: [processingJobs.type, processingJobs.mediaAssetId],
          set: {
            status: 'queued',
            progress: 0,
            error: null,
            startedAt: null,
            completedAt: null,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!transcriptionJob) {
        throw new Error('Failed to create transcription job.');
      }
      await upsertDerivedAsset(tx, {
        projectId: payload.projectId,
        kind: 'thumbnail',
        storageKey: thumbnailKey,
        mimeType: 'image/jpeg',
        sizeBytes: thumbnail.sizeBytes,
        etag: thumbnail.etag,
      });
      await upsertDerivedAsset(tx, {
        projectId: payload.projectId,
        kind: 'audio',
        storageKey: audioKey,
        mimeType: 'audio/wav',
        sizeBytes: audio.sizeBytes,
        etag: audio.etag,
        durationMs: metadata.durationMs,
      });

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
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(projects.id, payload.projectId));

      return {
        processingJobId: transcriptionJob.id,
        projectId: payload.projectId,
        mediaAssetId: audioAsset.id,
        storageKey: audioKey,
      };
    });

    await enqueueTranscription(transcriptionPayload);
    await updateProgress(100);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ingestion failure.';
    await db
      .update(processingJobs)
      .set({
        status: finalAttempt ? 'failed' : 'queued',
        progress: 0,
        error: message.slice(0, 4000),
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, payload.processingJobId));
    if (finalAttempt) {
      await db
        .update(projects)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(projects.id, payload.projectId));
    }
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function markProcessing(
  db: Database,
  processingJobId: string,
  progress: number,
): Promise<void> {
  await db
    .update(processingJobs)
    .set({
      status: 'processing',
      progress,
      error: null,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(processingJobs.id, processingJobId));
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

async function upsertDerivedAsset(
  tx: Transaction,
  values: typeof mediaAssets.$inferInsert,
): Promise<typeof mediaAssets.$inferSelect> {
  const [asset] = await tx
    .insert(mediaAssets)
    .values(values)
    .onConflictDoUpdate({
      target: mediaAssets.storageKey,
      set: {
        mimeType: values.mimeType,
        sizeBytes: values.sizeBytes,
        etag: values.etag,
        durationMs: values.durationMs,
        width: values.width,
        height: values.height,
      },
    })
    .returning();

  if (!asset) throw new Error('Failed to persist derived media asset.');
  return asset;
}
