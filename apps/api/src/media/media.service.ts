import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { mediaAssets } from '@lynvado/database';
import { DatabaseService } from '../database/database.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { ObjectStorage } from '../storage/object-storage.js';

@Injectable()
export class MediaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projectsService: ProjectsService,
    private readonly storage: ObjectStorage,
  ) {}
  async list(ownerId: string, projectId: string) {
    await this.projectsService.findOne(ownerId, projectId);
    const assets = await this.database.db.select().from(mediaAssets)
      .where(eq(mediaAssets.projectId, projectId)).orderBy(asc(mediaAssets.createdAt));
    return Promise.all(assets.map(async ({ storageKey, ...asset }) => ({
      ...asset,
      downloadUrl: ['proxy', 'original', 'thumbnail', 'audio'].includes(asset.kind)
        ? await this.storage.createDownloadUrl(storageKey, 60 * 60)
        : null,
    })));
  }
}
