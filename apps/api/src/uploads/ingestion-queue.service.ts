import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export interface IngestionJobPayload {
  processingJobId: string;
  projectId: string;
  mediaAssetId: string;
  storageKey: string;
}

@Injectable()
export class IngestionQueueService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly queue: Queue<IngestionJobPayload>;

  constructor(configService: ConfigService) {
    this.redis = new Redis(
      configService.getOrThrow<string>('REDIS_URL'),
      { maxRetriesPerRequest: null },
    );
    this.queue = new Queue<IngestionJobPayload>('media-ingestion', {
      connection: this.redis,
    });
  }

  async enqueue(payload: IngestionJobPayload): Promise<void> {
    await this.queue.add('ingest-original', payload, {
      jobId: payload.processingJobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  async requeue(payload: IngestionJobPayload): Promise<void> {
    const existing = await this.queue.getJob(payload.processingJobId);
    if (existing) await existing.remove();
    await this.enqueue(payload);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.redis.quit();
  }
}
