import * as schema from '@lynvado/database';
import { Job, Queue, Worker } from 'bullmq';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Redis } from 'ioredis';
import { Pool } from 'pg';

import { workerConfig } from './config.js';
import {
  type IngestionJobPayload,
  processIngestion,
} from './processor.js';
import { processExport, type ExportJobPayload } from './export-processor.js';

const pool = new Pool({ connectionString: workerConfig.DATABASE_URL });
const db = drizzle({ client: pool, schema });
const redis = new Redis(workerConfig.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const transcriptionQueue = new Queue('media-transcription', {
  connection: redis,
});

const worker = new Worker<IngestionJobPayload>(
  'media-ingestion',
  async (job: Job<IngestionJobPayload>) => {
    await processIngestion(
      db,
      job.data,
      async (progress) => job.updateProgress(progress),
      async (payload) => {
        await transcriptionQueue.add('transcribe-audio', payload, {
          jobId: payload.processingJobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        });
      },
      job.attemptsMade + 1 >= (job.opts.attempts ?? 1),
    );
  },
  {
    connection: redis,
    concurrency: workerConfig.VIDEO_WORKER_CONCURRENCY,
  },
);

const exportWorker = new Worker<ExportJobPayload>(
  'media-export',
  async (job: Job<ExportJobPayload>) => {
    await processExport(
      db,
      job.data,
      async (progress) => job.updateProgress(progress),
      job.attemptsMade + 1 >= (job.opts.attempts ?? 1),
    );
  },
  { connection: redis, concurrency: 1 },
);

worker.on('ready', () => {
  console.log('Lynvado video worker is ready.');
});
worker.on('completed', (job) => {
  console.log(`Completed media ingestion job ${job.id}.`);
});
worker.on('failed', (job, error) => {
  console.error(`Media ingestion job ${job?.id ?? 'unknown'} failed.`, error);
});
worker.on('error', (error) => {
  console.error('Video worker error.', error);
});
exportWorker.on('ready', () => console.log('Lynvado export worker is ready.'));
exportWorker.on('completed', (job) => console.log(`Completed export job ${job.id}.`));
exportWorker.on('failed', (job, error) => console.error(`Export job ${job?.id ?? 'unknown'} failed.`, error));
exportWorker.on('error', (error) => console.error('Export worker error.', error));

async function shutdown(): Promise<void> {
  await worker.close();
  await exportWorker.close();
  await transcriptionQueue.close();
  await redis.quit();
  await pool.end();
}

process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));
