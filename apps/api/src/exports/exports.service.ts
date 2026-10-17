import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { editorTimelines, mediaAssets, processingJobs } from '@lynvado/database';

import { DatabaseService } from '../database/database.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { ObjectStorage } from '../storage/object-storage.js';
import { ExportQueueService } from './export-queue.service.js';

@Injectable()
export class ExportsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projectsService: ProjectsService,
    private readonly storage: ObjectStorage,
    private readonly queue: ExportQueueService,
  ) {}

  async create(ownerId: string, projectId: string, requestKey: string) {
    await this.projectsService.findOne(ownerId, projectId);
    const [saved] = await this.database.db.select().from(editorTimelines)
      .where(eq(editorTimelines.projectId, projectId)).limit(1);
    if (!saved || saved.timeline.videoTrack.clips.length === 0) {
      throw new BadRequestException('Save a timeline with at least one clip before exporting.');
    }
    const [job] = await this.database.db.insert(processingJobs).values({
      projectId, type: 'export', status: 'queued', requestKey,
    }).onConflictDoNothing({
      target: [processingJobs.projectId, processingJobs.type, processingJobs.requestKey],
    }).returning();
    const resolvedJob = job ?? (await this.database.db.select().from(processingJobs).where(and(
      eq(processingJobs.projectId, projectId),
      eq(processingJobs.type, 'export'),
      eq(processingJobs.requestKey, requestKey),
    )).limit(1))[0];
    if (!resolvedJob) throw new Error('Failed to create export job.');
    if (!job) return this.describe(resolvedJob);
    try {
      await this.queue.enqueue({
        processingJobId: resolvedJob.id,
        projectId,
        timelineVersion: saved.version,
        timeline: saved.timeline,
      });
    } catch (error) {
      await this.database.db.update(processingJobs).set({
        status: 'failed', error: 'Could not queue export.', updatedAt: new Date(),
      }).where(eq(processingJobs.id, resolvedJob.id));
      throw error;
    }
    return this.describe(resolvedJob);
  }

  async list(ownerId: string, projectId: string) {
    await this.projectsService.findOne(ownerId, projectId);
    const jobs = await this.database.db.select().from(processingJobs)
      .where(and(eq(processingJobs.projectId, projectId), eq(processingJobs.type, 'export')))
      .orderBy(desc(processingJobs.createdAt)).limit(20);
    return Promise.all(jobs.map((job) => this.describe(job)));
  }

  async download(ownerId: string, projectId: string, jobId: string) {
    await this.projectsService.findOne(ownerId, projectId);
    const [job] = await this.database.db.select().from(processingJobs).where(and(
      eq(processingJobs.id, jobId), eq(processingJobs.projectId, projectId), eq(processingJobs.type, 'export'),
    )).limit(1);
    if (!job || job.status !== 'completed' || !job.mediaAssetId) {
      throw new NotFoundException('Completed export not found.');
    }
    const [asset] = await this.database.db.select().from(mediaAssets)
      .where(and(eq(mediaAssets.id, job.mediaAssetId), eq(mediaAssets.projectId, projectId))).limit(1);
    if (!asset) throw new NotFoundException('Export file not found.');
    return {
      fileName: asset.originalFileName ?? `lynvado-export-${job.id}.mp4`,
      downloadUrl: await this.storage.createDownloadUrl(
        asset.storageKey,
        15 * 60,
        asset.originalFileName ?? `lynvado-export-${job.id}.mp4`,
      ),
    };
  }

  private async describe(job: typeof processingJobs.$inferSelect) {
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      downloadable: job.status === 'completed' && Boolean(job.mediaAssetId),
    };
  }
}
