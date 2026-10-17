import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TimelineDocument } from '@lynvado/database';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export interface ExportJobPayload {
  processingJobId: string;
  projectId: string;
  timelineVersion: number;
  timeline: TimelineDocument;
}

@Injectable()
export class ExportQueueService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly queue: Queue<ExportJobPayload>;

  constructor(configService: ConfigService) {
    this.redis = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue<ExportJobPayload>('media-export', { connection: this.redis });
  }

  async enqueue(payload: ExportJobPayload): Promise<void> {
    await this.queue.add('render-timeline', payload, {
      jobId: payload.processingJobId,
      attempts: 2,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.redis.quit();
  }
}
