import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as databaseSchema from '@lynvado/database';
import { mediaAssets, processingJobs, type TimelineDocument } from '@lynvado/database';
import { and, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { burnCaptions, concatenateSegments, renderTimelineSegment } from './media-tools.js';
import { downloadObject, uploadObject } from './storage.js';

export interface ExportJobPayload {
  processingJobId: string;
  projectId: string;
  timelineVersion: number;
  timeline: TimelineDocument;
}

type Database = NodePgDatabase<typeof databaseSchema>;
const sizes = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
} as const;

export async function processExport(
  db: Database,
  payload: ExportJobPayload,
  updateProgress: (progress: number) => Promise<void>,
  finalAttempt = true,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'lynvado-export-'));
  try {
    const [jobRecord] = await db.select().from(processingJobs).where(and(
      eq(processingJobs.id, payload.processingJobId),
      eq(processingJobs.projectId, payload.projectId),
      eq(processingJobs.type, 'export'),
    )).limit(1);
    if (!jobRecord) throw new Error('Export job scope is invalid.');
    await mark(db, payload.processingJobId, 3);
    const ids = [...new Set(payload.timeline.videoTrack.clips.map(({ assetId }) => assetId))];
    const assets = await db.select().from(mediaAssets).where(and(
      eq(mediaAssets.projectId, payload.projectId), inArray(mediaAssets.id, ids),
    ));
    if (assets.length !== ids.length) throw new Error('One or more timeline assets are unavailable.');

    const paths = new Map<string, string>();
    for (const [index, asset] of assets.entries()) {
      const path = join(directory, `source-${index}${extension(asset.mimeType)}`);
      await downloadObject(asset.storageKey, path);
      paths.set(asset.id, path);
    }
    await updateProgress(10);

    const segmentPaths: string[] = [];
    const size = sizes[payload.timeline.aspectRatio];
    for (const [index, clip] of payload.timeline.videoTrack.clips.entries()) {
      const source = paths.get(clip.assetId);
      if (!source) throw new Error('Timeline source could not be downloaded.');
      const segment = join(directory, `segment-${String(index).padStart(4, '0')}.mp4`);
      await renderTimelineSegment(source, segment, clip.inMs, clip.outMs - clip.inMs, size);
      segmentPaths.push(segment);
      const progress = 10 + Math.round(((index + 1) / payload.timeline.videoTrack.clips.length) * 65);
      await mark(db, payload.processingJobId, progress);
      await updateProgress(progress);
    }

    const concatPath = join(directory, 'concat.txt');
    await writeFile(concatPath, segmentPaths.map((path) => `file '${path.replaceAll('\\', '/')}'`).join('\n'), 'utf8');
    const joinedPath = join(directory, 'joined.mp4');
    await concatenateSegments(concatPath, joinedPath);
    await mark(db, payload.processingJobId, 82);

    const outputPath = join(directory, 'export.mp4');
    const captions = exportCaptions(payload.timeline);
    if (payload.timeline.captionTrack.enabled && captions.length) {
      const srtPath = join(directory, 'captions.srt');
      await writeFile(srtPath, captions.map((item, index) =>
        `${index + 1}\n${srtTime(item.startMs)} --> ${srtTime(item.endMs)}\n${item.text.replaceAll(/\r?\n/g, ' ')}\n`,
      ).join('\n'), 'utf8');
      await burnCaptions(joinedPath, srtPath, outputPath);
    } else {
      await copyFile(joinedPath, outputPath);
    }

    const storageKey = `projects/${payload.projectId}/exports/${payload.processingJobId}.mp4`;
    const uploaded = await uploadObject(storageKey, outputPath, 'video/mp4');
    const durationMs = payload.timeline.videoTrack.clips.reduce((sum, clip) => sum + clip.outMs - clip.inMs, 0);
    await db.transaction(async (tx) => {
      const [asset] = await tx.insert(mediaAssets).values({
        projectId: payload.projectId,
        kind: 'export',
        storageKey,
        originalFileName: `lynvado-export-v${payload.timelineVersion}.mp4`,
        mimeType: 'video/mp4',
        sizeBytes: uploaded.sizeBytes,
        etag: uploaded.etag,
        durationMs,
        width: size.width,
        height: size.height,
      }).onConflictDoUpdate({
        target: mediaAssets.storageKey,
        set: {
          sizeBytes: uploaded.sizeBytes,
          etag: uploaded.etag,
          durationMs,
          width: size.width,
          height: size.height,
        },
      }).returning();
      if (!asset) throw new Error('Failed to persist export asset.');
      await tx.update(processingJobs).set({
        mediaAssetId: asset.id,
        status: 'completed',
        progress: 100,
        error: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(processingJobs.id, payload.processingJobId));
    });
    await updateProgress(100);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown export failure.';
    await db.update(processingJobs).set({
      status: finalAttempt ? 'failed' : 'queued',
      progress: 0,
      error: message.slice(0, 4000),
      updatedAt: new Date(),
    }).where(and(
      eq(processingJobs.id, payload.processingJobId),
      eq(processingJobs.projectId, payload.projectId),
      eq(processingJobs.type, 'export'),
    ));
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function mark(db: Database, id: string, progress: number) {
  await db.update(processingJobs).set({
    status: 'processing', progress, error: null, startedAt: new Date(), updatedAt: new Date(),
  }).where(eq(processingJobs.id, id));
}

function exportCaptions(timeline: TimelineDocument) {
  const result: Array<{ startMs: number; endMs: number; text: string }> = [];
  let offset = 0;
  for (const clip of timeline.videoTrack.clips) {
    for (const caption of timeline.captionTrack.items) {
      const start = Math.max(clip.inMs, caption.startMs);
      const end = Math.min(clip.outMs, caption.endMs);
      if (end > start && caption.text.trim()) result.push({
        startMs: offset + start - clip.inMs,
        endMs: offset + end - clip.inMs,
        text: caption.text.trim(),
      });
    }
    offset += clip.outMs - clip.inMs;
  }
  return result;
}

function srtTime(ms: number) {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function extension(mimeType: string) {
  if (mimeType === 'video/quicktime') return '.mov';
  if (mimeType === 'video/webm') return '.webm';
  return '.mp4';
}
