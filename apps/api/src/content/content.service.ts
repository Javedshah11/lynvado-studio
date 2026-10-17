import { Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  desc,
  eq,
} from 'drizzle-orm';
import {
  captionSegments,
  captionTracks,
  clipSuggestions,
  type ClipSuggestionStatus,
} from '@lynvado/database';

import { DatabaseService } from '../database/database.service.js';
import { ProjectsService } from '../projects/projects.service.js';

@Injectable()
export class ContentService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projectsService: ProjectsService,
  ) {}

  async getCaptions(ownerId: string, projectId: string) {
    await this.projectsService.findOne(ownerId, projectId);
    const [track] = await this.database.db
      .select()
      .from(captionTracks)
      .where(eq(captionTracks.projectId, projectId))
      .orderBy(desc(captionTracks.updatedAt))
      .limit(1);
    if (!track) throw new NotFoundException('Captions not found.');

    const segments = await this.database.db
      .select()
      .from(captionSegments)
      .where(eq(captionSegments.trackId, track.id))
      .orderBy(captionSegments.position);
    return { ...track, segments };
  }

  async updateCaption(
    ownerId: string,
    projectId: string,
    segmentId: string,
    text: string,
  ) {
    await this.projectsService.findOne(ownerId, projectId);
    const [updated] = await this.database.db
      .update(captionSegments)
      .set({ text, updatedAt: new Date() })
      .where(
        and(
          eq(captionSegments.id, segmentId),
          eq(
            captionSegments.trackId,
            this.database.db
              .select({ id: captionTracks.id })
              .from(captionTracks)
              .where(eq(captionTracks.projectId, projectId))
              .limit(1),
          ),
        ),
      )
      .returning();
    if (!updated) throw new NotFoundException('Caption segment not found.');
    return updated;
  }

  async getClips(ownerId: string, projectId: string) {
    await this.projectsService.findOne(ownerId, projectId);
    return this.database.db
      .select()
      .from(clipSuggestions)
      .where(eq(clipSuggestions.projectId, projectId))
      .orderBy(desc(clipSuggestions.score));
  }

  async updateClipStatus(
    ownerId: string,
    projectId: string,
    clipId: string,
    status: ClipSuggestionStatus,
  ) {
    await this.projectsService.findOne(ownerId, projectId);
    const [updated] = await this.database.db
      .update(clipSuggestions)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(clipSuggestions.id, clipId),
          eq(clipSuggestions.projectId, projectId),
        ),
      )
      .returning();
    if (!updated) throw new NotFoundException('Clip suggestion not found.');
    return updated;
  }
}
