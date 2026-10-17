import type { DatabaseService } from '../database/database.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { ObjectStorage } from '../storage/object-storage.js';
import type { ExportQueueService } from './export-queue.service.js';
import { ExportsService } from './exports.service.js';

describe('ExportsService', () => {
  const projectId = '9f7776b6-aefd-4f2a-bd36-68b82c85de82';
  const ownerId = 'aa99ed73-70d1-4a94-b9f8-aa029b1853fa';
  const timeline = {
    schemaVersion: 1 as const,
    aspectRatio: '16:9' as const,
    videoTrack: { clips: [{ id: crypto.randomUUID(), assetId: crypto.randomUUID(), inMs: 0, outMs: 1000 }] },
    captionTrack: { enabled: true, items: [] },
  };
  const job = {
    id: crypto.randomUUID(), projectId, mediaAssetId: null, type: 'export' as const,
    status: 'queued' as const, progress: 0, error: null, requestKey: 'export-request-1',
    createdAt: new Date(), startedAt: null, completedAt: null, updatedAt: new Date(),
  };

  function setup(createdJob: typeof job | undefined) {
    const timelineLimit = vi.fn().mockResolvedValue([{ version: 7, timeline }]);
    const existingLimit = vi.fn().mockResolvedValue([job]);
    const database = {
      db: {
        select: vi.fn()
          .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: timelineLimit }) }) })
          .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: existingLimit }) }) }),
        insert: vi.fn(() => ({
          values: () => ({ onConflictDoNothing: () => ({ returning: vi.fn().mockResolvedValue(createdJob ? [createdJob] : []) }) }),
        })),
        update: vi.fn(() => ({ set: () => ({ where: vi.fn() }) })),
      },
    };
    const projects = { findOne: vi.fn().mockResolvedValue({ id: projectId }) };
    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = new ExportsService(
      database as unknown as DatabaseService,
      projects as unknown as ProjectsService,
      {} as ObjectStorage,
      queue as unknown as ExportQueueService,
    );
    return { service, projects, queue };
  }

  it('authorizes project ownership before reading the timeline', async () => {
    const { service, projects } = setup(job);
    projects.findOne.mockRejectedValue(new Error('Project not found.'));
    await expect(service.create(ownerId, projectId, 'export-request-1')).rejects.toThrow('Project not found.');
  });

  it('queues a newly-created export exactly once', async () => {
    const { service, queue } = setup(job);
    await service.create(ownerId, projectId, 'export-request-1');
    expect(queue.enqueue).toHaveBeenCalledOnce();
    expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      processingJobId: job.id, projectId, timelineVersion: 7, timeline,
    }));
  });

  it('returns the existing job for a repeated idempotency key without requeueing', async () => {
    const { service, queue } = setup(undefined);
    const result = await service.create(ownerId, projectId, 'export-request-1');
    expect(result).toMatchObject({ id: job.id, status: 'queued' });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
