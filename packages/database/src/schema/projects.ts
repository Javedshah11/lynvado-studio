import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './auth.js';

export const projectStatuses = [
  'draft',
  'processing',
  'ready',
  'failed',
  'archived',
] as const;

export type ProjectStatus =
  (typeof projectStatuses)[number];

export const projects = pgTable(
  'projects',
  {
    id: uuid('id')
      .defaultRandom()
      .primaryKey(),

    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    name: varchar('name', {
      length: 160,
    }).notNull(),

    status: varchar('status', {
      length: 32,
    })
      .$type<ProjectStatus>()
      .notNull()
      .default('draft'),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('projects_owner_id_idx').on(
      table.ownerId,
    ),

    index(
      'projects_owner_created_at_idx',
    ).on(
      table.ownerId,
      table.createdAt,
    ),

    index('projects_status_idx').on(
      table.status,
    ),
  ],
);

export type Project =
  typeof projects.$inferSelect;

export type NewProject =
  typeof projects.$inferInsert;