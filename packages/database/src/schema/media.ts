import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { projects } from './projects.js';

export const mediaAssetKinds = [
  'original',
  'proxy',
  'thumbnail',
  'audio',
  'export',
] as const;

export type MediaAssetKind = (typeof mediaAssetKinds)[number];

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 32 })
      .$type<MediaAssetKind>()
      .notNull(),
    storageKey: text('storage_key').notNull(),
    originalFileName: varchar('original_file_name', { length: 255 }),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    etag: varchar('etag', { length: 128 }),
    durationMs: integer('duration_ms'),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('media_assets_storage_key_unique').on(table.storageKey),
    index('media_assets_project_id_idx').on(table.projectId),
    index('media_assets_project_kind_idx').on(table.projectId, table.kind),
  ],
);

export const uploadIntentStatuses = ['pending', 'completed', 'expired'] as const;
export type UploadIntentStatus = (typeof uploadIntentStatuses)[number];

export const uploadIntents = pgTable(
  'upload_intents',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    status: varchar('status', { length: 32 })
      .$type<UploadIntentStatus>()
      .notNull()
      .default('pending'),
    assetId: uuid('asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('upload_intents_storage_key_unique').on(table.storageKey),
    index('upload_intents_project_id_idx').on(table.projectId),
    index('upload_intents_expires_at_idx').on(table.expiresAt),
  ],
);

export const processingJobTypes = ['ingestion', 'transcription', 'clip_generation', 'export'] as const;
export type ProcessingJobType = (typeof processingJobTypes)[number];

export const processingJobStatuses = ['queued', 'processing', 'completed', 'failed'] as const;
export type ProcessingJobStatus = (typeof processingJobStatuses)[number];

export const processingJobs = pgTable(
  'processing_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    mediaAssetId: uuid('media_asset_id').references(() => mediaAssets.id, {
      onDelete: 'cascade',
    }),
    type: varchar('type', { length: 32 })
      .$type<ProcessingJobType>()
      .notNull(),
    status: varchar('status', { length: 32 })
      .$type<ProcessingJobStatus>()
      .notNull()
      .default('queued'),
    requestKey: varchar('request_key', { length: 128 }),
    progress: integer('progress').notNull().default(0),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('processing_jobs_project_id_idx').on(table.projectId),
    index('processing_jobs_status_type_idx').on(table.status, table.type),
    uniqueIndex('processing_jobs_ingestion_asset_unique').on(
      table.type,
      table.mediaAssetId,
    ),
    uniqueIndex('processing_jobs_project_type_request_unique').on(
      table.projectId,
      table.type,
      table.requestKey,
    ),
  ],
);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type UploadIntent = typeof uploadIntents.$inferSelect;
export type ProcessingJob = typeof processingJobs.$inferSelect;
