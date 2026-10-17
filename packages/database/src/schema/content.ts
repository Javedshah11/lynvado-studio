import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { projects } from './projects.js';
import { transcripts } from './transcriptions.js';

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  position: 'top' | 'center' | 'bottom';
}

export const captionTracks = pgTable(
  'caption_tracks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    transcriptId: uuid('transcript_id')
      .notNull()
      .references(() => transcripts.id, { onDelete: 'cascade' }),
    language: varchar('language', { length: 16 }),
    style: jsonb('style').$type<CaptionStyle>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('caption_tracks_transcript_id_unique').on(table.transcriptId),
    index('caption_tracks_project_id_idx').on(table.projectId),
  ],
);

export const captionSegments = pgTable(
  'caption_segments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    trackId: uuid('track_id')
      .notNull()
      .references(() => captionTracks.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('caption_segments_position_unique').on(table.trackId, table.position),
    index('caption_segments_time_idx').on(table.trackId, table.startMs),
  ],
);

export const clipSuggestionStatuses = ['suggested', 'accepted', 'rejected'] as const;
export type ClipSuggestionStatus = (typeof clipSuggestionStatuses)[number];

export interface ClipScoreSignals {
  hookStrength: number;
  topicCompleteness: number;
  speechQuality: number;
  semanticImportance: number;
  boundaryQuality: number;
  durationFit: number;
  visualContinuity: number;
}

export const clipSuggestions = pgTable(
  'clip_suggestions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    transcriptId: uuid('transcript_id')
      .notNull()
      .references(() => transcripts.id, { onDelete: 'cascade' }),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    score: doublePrecision('score').notNull(),
    reason: text('reason').notNull(),
    signals: jsonb('signals').$type<ClipScoreSignals>().notNull(),
    status: varchar('status', { length: 32 })
      .$type<ClipSuggestionStatus>()
      .notNull()
      .default('suggested'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('clip_suggestions_window_unique').on(
      table.transcriptId,
      table.startMs,
      table.endMs,
    ),
    index('clip_suggestions_project_score_idx').on(table.projectId, table.score),
  ],
);
