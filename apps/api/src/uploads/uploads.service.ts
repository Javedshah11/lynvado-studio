import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ProjectsService } from '../projects/projects.service.js';
import { ObjectStorage } from '../storage/object-storage.js';
import { IngestionQueueService } from './ingestion-queue.service.js';
import type { InitializeUploadInput } from './uploads.schema.js';
import { UploadsRepository } from './uploads.repository.js';

@Injectable()
export class UploadsService {
  private readonly maxBytes: number;
  private readonly signedUrlTtlSeconds: number;

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly uploadsRepository: UploadsRepository,
    private readonly storage: ObjectStorage,
    private readonly ingestionQueue: IngestionQueueService,
    configService: ConfigService,
  ) {
    this.maxBytes = configService.getOrThrow<number>('UPLOAD_MAX_BYTES');
    this.signedUrlTtlSeconds = configService.getOrThrow<number>(
      'STORAGE_SIGNED_URL_TTL_SECONDS',
    );
  }

  async initialize(
    ownerId: string,
    projectId: string,
    input: InitializeUploadInput,
  ) {
    await this.projectsService.findOne(ownerId, projectId);

    if (input.sizeBytes > this.maxBytes) {
      throw new BadRequestException(
        `Video exceeds the ${this.maxBytes} byte upload limit.`,
      );
    }

    const uploadId = randomUUID();
    const storageKey = [
      'users',
      ownerId,
      'projects',
      projectId,
      'originals',
      uploadId,
    ].join('/');
    const expiresAt = new Date(
      Date.now() + this.signedUrlTtlSeconds * 1000,
    );

    await this.uploadsRepository.createIntent({
      id: uploadId,
      projectId,
      storageKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      expiresAt,
    });

    try {
      const uploadUrl = await this.storage.createUploadUrl(
        storageKey,
        { contentType: input.mimeType },
        this.signedUrlTtlSeconds,
      );

      return {
        uploadId,
        uploadUrl,
        method: 'PUT' as const,
        headers: { 'Content-Type': input.mimeType },
        expiresAt: expiresAt.toISOString(),
        maxBytes: this.maxBytes,
      };
    } catch (error) {
      await this.uploadsRepository.deletePendingIntent(uploadId);
      throw error;
    }
  }

  async complete(
    ownerId: string,
    projectId: string,
    uploadId: string,
  ) {
    await this.projectsService.findOne(ownerId, projectId);

    const intent = await this.uploadsRepository.findIntent(uploadId, projectId);
    if (!intent) throw new NotFoundException('Upload not found.');

    if (intent.status === 'pending' && intent.expiresAt <= new Date()) {
      throw new BadRequestException('Upload has expired.');
    }

    let etag: string | null = null;

    if (intent.status === 'pending') {
      const object = await this.storage.statObject(intent.storageKey);

      if (!object) {
        throw new BadRequestException('Uploaded video was not found in storage.');
      }

      if (object.contentLength !== intent.sizeBytes) {
        throw new BadRequestException('Uploaded video size does not match initialization.');
      }

      if (object.contentType !== intent.mimeType) {
        throw new BadRequestException('Uploaded video type does not match initialization.');
      }

      etag = object.etag;
    }

    const finalized = await this.uploadsRepository.finalize({
      uploadId,
      projectId,
      etag,
      contentType: intent.mimeType,
      sizeBytes: intent.sizeBytes,
    });

    await this.ingestionQueue.enqueue({
      processingJobId: finalized.job.id,
      projectId,
      mediaAssetId: finalized.asset.id,
      storageKey: finalized.asset.storageKey,
    });

    return {
      asset: {
        id: finalized.asset.id,
        projectId: finalized.asset.projectId,
        kind: finalized.asset.kind,
        originalFileName: finalized.asset.originalFileName,
        mimeType: finalized.asset.mimeType,
        sizeBytes: finalized.asset.sizeBytes,
        createdAt: finalized.asset.createdAt,
      },
      processingJob: {
        id: finalized.job.id,
        type: finalized.job.type,
        status: finalized.job.status,
        progress: finalized.job.progress,
      },
    };
  }
}
