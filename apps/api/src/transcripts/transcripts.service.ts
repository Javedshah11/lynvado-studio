import { Injectable, NotFoundException } from '@nestjs/common';
import {
  desc,
  eq,
} from 'drizzle-orm';
import {
  transcriptSegments,
  transcripts,
} from '@lynvado/database';

import { DatabaseService } from '../database/database.service.js';
import { ProjectsService } from '../projects/projects.service.js';

@Injectable()
export class TranscriptsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projectsService: ProjectsService,
  ) {}

  async findForProject(ownerId: string, projectId: string) {
    await this.projectsService.findOne(ownerId, projectId);

    const [transcript] = await this.database.db
      .select()
      .from(transcripts)
      .where(eq(transcripts.projectId, projectId))
      .orderBy(desc(transcripts.updatedAt))
      .limit(1);

    if (!transcript) throw new NotFoundException('Transcript not found.');

    const segments = await this.database.db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.transcriptId, transcript.id))
      .orderBy(transcriptSegments.position);

    return { ...transcript, segments };
  }
}
