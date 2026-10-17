import { integer, jsonb, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { projects } from './projects.js';

export type TimelineAspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export interface TimelineClip {
  id: string;
  assetId: string;
  inMs: number;
  outMs: number;
}

export interface TimelineCaption {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface TimelineDocument {
  schemaVersion: 1;
  aspectRatio: TimelineAspectRatio;
  videoTrack: { clips: TimelineClip[] };
  captionTrack: { enabled: boolean; items: TimelineCaption[] };
}

export const editorTimelines = pgTable(
  'editor_timelines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(1),
    timeline: jsonb('timeline').$type<TimelineDocument>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('editor_timelines_project_id_unique').on(table.projectId)],
);

export type EditorTimeline = typeof editorTimelines.$inferSelect;
