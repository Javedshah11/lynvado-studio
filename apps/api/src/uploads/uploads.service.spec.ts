import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { ProjectsService } from '../projects/projects.service.js';
import type { ObjectStorage } from '../storage/object-storage.js';
import type { IngestionQueueService } from './ingestion-queue.service.js';
import { UploadsService } from './uploads.service.js';
import type { UploadsRepository } from './uploads.repository.js';

describe('UploadsService', () => {
  const projectId = '9f7776b6-aefd-4f2a-bd36-68b82c85de82';
  const ownerId = 'aa99ed73-70d1-4a94-b9f8-aa029b1853fa';
  const uploadId = '50e1eff7-e283-441b-8bd0-7905331d18cb';

  function createService() {
    const projects = { findOne: vi.fn().mockResolvedValue({ id: projectId }) };
    const repository = {
      createIntent: vi.fn(),
      deletePendingIntent: vi.fn(),
      findIntent: vi.fn(),
      finalize: vi.fn(),
    };
    const storage = {
      createUploadUrl: vi.fn().mockResolvedValue('http://storage/upload'),
      statObject: vi.fn(),
    };
    const queue = { enqueue: vi.fn() };
    const config = {
      getOrThrow: vi.fn((key: string) => ({
        UPLOAD_MAX_BYTES: 1000,
        STORAGE_SIGNED_URL_TTL_SECONDS: 900,
      })[key]),
    };

    const service = new UploadsService(
      projects as unknown as ProjectsService,
      repository as unknown as UploadsRepository,
      storage as unknown as ObjectStorage,
      queue as unknown as IngestionQueueService,
      config as unknown as ConfigService,
    );

    return { service, projects, repository, storage, queue };
  }

  it('rejects an upload larger than the configured limit', async () => {
    const { service, repository } = createService();

    await expect(
      service.initialize(ownerId, projectId, {
        fileName: 'video.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 1001,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.createIntent).not.toHaveBeenCalled();
  });

  it('creates an intent before returning a signed upload URL', async () => {
    const { service, repository, storage } = createService();

    const result = await service.initialize(ownerId, projectId, {
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 500,
    });

    expect(repository.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({ projectId, mimeType: 'video/mp4', sizeBytes: 500 }),
    );
    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      expect.stringContaining(`/projects/${projectId}/originals/`),
      { contentType: 'video/mp4' },
      900,
    );
    expect(result).toMatchObject({
      uploadUrl: 'http://storage/upload',
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
    });
  });

  it('rejects completion when stored metadata does not match', async () => {
    const { service, repository, storage } = createService();
    repository.findIntent.mockResolvedValue({
      id: uploadId,
      projectId,
      storageKey: `projects/${projectId}/originals/${uploadId}`,
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 500,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    });
    storage.statObject.mockResolvedValue({
      contentLength: 499,
      contentType: 'video/mp4',
      etag: 'etag',
    });

    await expect(
      service.complete(ownerId, projectId, uploadId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.finalize).not.toHaveBeenCalled();
  });

  it('finalizes and publishes a verified upload for ingestion', async () => {
    const { service, repository, storage, queue } = createService();
    repository.findIntent.mockResolvedValue({
      id: uploadId,
      projectId,
      storageKey: `projects/${projectId}/originals/${uploadId}`,
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 500,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    });
    storage.statObject.mockResolvedValue({
      contentLength: 500,
      contentType: 'video/mp4',
      etag: 'verified-etag',
    });
    repository.finalize.mockResolvedValue({
      asset: {
        id: 'asset-id',
        projectId,
        storageKey: `projects/${projectId}/originals/${uploadId}`,
      },
      job: { id: 'job-id' },
    });

    const result = await service.complete(ownerId, projectId, uploadId);

    expect(repository.finalize).toHaveBeenCalledWith(
      expect.objectContaining({ etag: 'verified-etag' }),
    );
    expect(queue.enqueue).toHaveBeenCalledWith({
      processingJobId: 'job-id',
      projectId,
      mediaAssetId: 'asset-id',
      storageKey: `projects/${projectId}/originals/${uploadId}`,
    });
    expect(result.asset.id).toBe('asset-id');
  });
});
