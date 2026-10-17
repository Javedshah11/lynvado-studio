import { Injectable } from '@nestjs/common';
import {
  and,
  eq,
} from 'drizzle-orm';
import {
  mediaAssets,
  processingJobs,
  projects,
  uploadIntents,
  type MediaAsset,
  type ProcessingJob,
  type UploadIntent,
} from '@lynvado/database';

import { DatabaseService } from '../database/database.service.js';

interface CreateIntentInput {
  id: string;
  projectId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: Date;
}

interface FinalizeUploadInput {
  uploadId: string;
  projectId: string;
  etag: string | null;
  contentType: string;
  sizeBytes: number;
}

export interface FinalizedUpload {
  asset: MediaAsset;
  job: ProcessingJob;
}

@Injectable()
export class UploadsRepository {
  constructor(private readonly database: DatabaseService) {}

  async createIntent(input: CreateIntentInput): Promise<UploadIntent> {
    const [intent] = await this.database.db
      .insert(uploadIntents)
      .values(input)
      .returning();

    if (!intent) throw new Error('Failed to create upload intent.');
    return intent;
  }

  async findIntent(
    uploadId: string,
    projectId: string,
  ): Promise<UploadIntent | null> {
    const [intent] = await this.database.db
      .select()
      .from(uploadIntents)
      .where(
        and(
          eq(uploadIntents.id, uploadId),
          eq(uploadIntents.projectId, projectId),
        ),
      )
      .limit(1);

    return intent ?? null;
  }

  async deletePendingIntent(uploadId: string): Promise<void> {
    await this.database.db
      .delete(uploadIntents)
      .where(
        and(
          eq(uploadIntents.id, uploadId),
          eq(uploadIntents.status, 'pending'),
        ),
      );
  }

  async finalize(input: FinalizeUploadInput): Promise<FinalizedUpload> {
    return this.database.db.transaction(async (tx) => {
      const [intent] = await tx
        .select()
        .from(uploadIntents)
        .where(
          and(
            eq(uploadIntents.id, input.uploadId),
            eq(uploadIntents.projectId, input.projectId),
          ),
        )
        .for('update')
        .limit(1);

      if (!intent) throw new Error('Upload intent not found.');

      if (intent.status === 'completed' && intent.assetId) {
        const existing = await this.findFinalized(tx, intent.assetId);
        if (existing) return existing;
      }

      if (intent.status !== 'pending' || intent.expiresAt <= new Date()) {
        throw new Error('Upload intent is no longer active.');
      }

      const [asset] = await tx
        .insert(mediaAssets)
        .values({
          projectId: intent.projectId,
          kind: 'original',
          storageKey: intent.storageKey,
          originalFileName: intent.fileName,
          mimeType: input.contentType,
          sizeBytes: input.sizeBytes,
          etag: input.etag,
        })
        .returning();

      if (!asset) throw new Error('Failed to create media asset.');

      const [job] = await tx
        .insert(processingJobs)
        .values({
          projectId: intent.projectId,
          mediaAssetId: asset.id,
          type: 'ingestion',
          status: 'queued',
        })
        .returning();

      if (!job) throw new Error('Failed to create processing job.');

      await tx
        .update(uploadIntents)
        .set({
          status: 'completed',
          assetId: asset.id,
          completedAt: new Date(),
        })
        .where(eq(uploadIntents.id, intent.id));

      await tx
        .update(projects)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(projects.id, intent.projectId));

      return { asset, job };
    });
  }

  private async findFinalized(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
    assetId: string,
  ): Promise<FinalizedUpload | null> {
    const [asset] = await tx
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, assetId))
      .limit(1);

    const [job] = await tx
      .select()
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.mediaAssetId, assetId),
          eq(processingJobs.type, 'ingestion'),
        ),
      )
      .limit(1);

    return asset && job ? { asset, job } : null;
  }
}
