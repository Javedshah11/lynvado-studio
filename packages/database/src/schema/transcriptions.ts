import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { mediaAssets } from './media.js';
import { projects } from './projects.js';

export const transcriptStatuses = ['processing', 'completed', 'failed'] as const;
export type TranscriptStatus = (typeof transcriptStatuses)[number];

export const transcripts = pgTable(
  'transcripts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),
    language: varchar('language', { length: 16 }),
    status: varchar('status', { length: 32 })
      .$type<TranscriptStatus>()
      .notNull()
      .default('processing'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('transcripts_media_asset_id_unique').on(table.mediaAssetId),
    index('transcripts_project_id_idx').on(table.projectId),
  ],
);

export const transcriptSegments = pgTable(
  'transcript_segments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    transcriptId: uuid('transcript_id')
      .notNull()
      .references(() => transcripts.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    text: text('text').notNull(),
    speaker: varchar('speaker', { length: 80 }),
    confidence: doublePrecision('confidence'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('transcript_segments_position_unique').on(
      table.transcriptId,
      table.position,
    ),
    index('transcript_segments_time_idx').on(
      table.transcriptId,
      table.startMs,
    ),
  ],
);

export type Transcript = typeof transcripts.$inferSelect;
export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
