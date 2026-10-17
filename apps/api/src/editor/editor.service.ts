import { ConflictException, Injectable, BadRequestException } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { editorTimelines, mediaAssets } from '@lynvado/database';

import { DatabaseService } from '../database/database.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import type { SaveTimelineInput } from './editor.schema.js';

@Injectable()
export class EditorService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projectsService: ProjectsService,
  ) {}

  async get(ownerId: string, projectId: string) {
    await this.projectsService.findOne(ownerId, projectId);
    const [timeline] = await this.database.db
      .select()
      .from(editorTimelines)
      .where(eq(editorTimelines.projectId, projectId))
      .limit(1);
    return timeline ?? null;
  }

  async save(ownerId: string, projectId: string, input: SaveTimelineInput) {
    await this.projectsService.findOne(ownerId, projectId);
    const assetIds = [...new Set(input.timeline.videoTrack.clips.map(({ assetId }) => assetId))];
    if (assetIds.length) {
      const assets = await this.database.db
        .select({ id: mediaAssets.id })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.projectId, projectId), inArray(mediaAssets.id, assetIds)));
      if (assets.length !== assetIds.length) {
        throw new BadRequestException('Timeline contains media from another project.');
      }
    }

    return this.database.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(editorTimelines)
        .where(eq(editorTimelines.projectId, projectId)).for('update').limit(1);

      if (!existing) {
        if (input.expectedVersion !== null) throw new ConflictException('Timeline version changed. Reload the editor.');
        const [created] = await tx.insert(editorTimelines)
          .values({ projectId, timeline: input.timeline }).returning();
        return created;
      }
      if (input.expectedVersion !== existing.version) {
        throw new ConflictException('Timeline version changed. Reload the editor.');
      }
      const [updated] = await tx.update(editorTimelines)
        .set({ timeline: input.timeline, version: existing.version + 1, updatedAt: new Date() })
        .where(and(eq(editorTimelines.id, existing.id), eq(editorTimelines.version, existing.version)))
        .returning();
      if (!updated) throw new ConflictException('Timeline version changed. Reload the editor.');
      return updated;
    });
  }
}
