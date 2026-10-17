import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { mediaAssets, processingJobs, projects } from '@lynvado/database';
import { DatabaseService } from '../database/database.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { ObjectStorage } from '../storage/object-storage.js';
import { IngestionQueueService } from '../uploads/ingestion-queue.service.js';

@Injectable()
export class MediaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projectsService: ProjectsService,
    private readonly storage: ObjectStorage,
    private readonly ingestionQueue: IngestionQueueService,
  ) {}
  async list(ownerId: string, projectId: string) {
    await this.projectsService.findOne(ownerId, projectId);
    const assets = await this.database.db.select().from(mediaAssets)
      .where(eq(mediaAssets.projectId, projectId)).orderBy(asc(mediaAssets.createdAt));
    return Promise.all(assets.map(async ({ storageKey, ...asset }) => ({
      ...asset,
      downloadUrl: ['proxy', 'original', 'thumbnail', 'audio'].includes(asset.kind)
        ? await this.storage.createDownloadUrl(storageKey, 60 * 60)
        : null,
    })));
  }

  async listJobs(ownerId: string, projectId: string) {
    await this.projectsService.findOne(ownerId, projectId);
    return this.database.db
      .select({
        id: processingJobs.id,
        mediaAssetId: processingJobs.mediaAssetId,
        type: processingJobs.type,
        status: processingJobs.status,
        progress: processingJobs.progress,
        error: processingJobs.error,
        createdAt: processingJobs.createdAt,
        startedAt: processingJobs.startedAt,
        completedAt: processingJobs.completedAt,
        updatedAt: processingJobs.updatedAt,
      })
      .from(processingJobs)
      .where(eq(processingJobs.projectId, projectId))
      .orderBy(desc(processingJobs.createdAt))
      .limit(50);
  }

  async retryIngestion(ownerId: string, projectId: string, jobId: string) {
    await this.projectsService.findOne(ownerId, projectId);
    const [failed] = await this.database.db
      .select({
        job: processingJobs,
        storageKey: mediaAssets.storageKey,
      })
      .from(processingJobs)
      .innerJoin(mediaAssets, eq(mediaAssets.id, processingJobs.mediaAssetId))
      .where(and(
        eq(processingJobs.id, jobId),
        eq(processingJobs.projectId, projectId),
        eq(processingJobs.type, 'ingestion'),
        eq(processingJobs.status, 'failed'),
        eq(mediaAssets.kind, 'original'),
      ))
      .limit(1);

    if (!failed || !failed.job.mediaAssetId) {
      throw new NotFoundException('Failed ingestion job not found.');
    }

    await this.database.db.transaction(async (tx) => {
      await tx.update(processingJobs).set({
        status: 'queued',
        progress: 0,
        error: null,
        startedAt: null,
        completedAt: null,
        updatedAt: new Date(),
      }).where(eq(processingJobs.id, jobId));
      await tx.update(projects).set({
        status: 'processing',
        updatedAt: new Date(),
      }).where(eq(projects.id, projectId));
    });

    try {
      await this.ingestionQueue.requeue({
        processingJobId: failed.job.id,
        projectId,
        mediaAssetId: failed.job.mediaAssetId,
        storageKey: failed.storageKey,
      });
    } catch (error) {
      await this.database.db.update(processingJobs).set({
        status: 'failed',
        error: 'Could not requeue ingestion.',
        updatedAt: new Date(),
      }).where(eq(processingJobs.id, jobId));
      throw error;
    }

    return { ...failed.job, status: 'queued' as const, progress: 0, error: null };
  }
}
