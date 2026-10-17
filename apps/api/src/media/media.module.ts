import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';

@Module({ imports: [AuthModule, DatabaseModule, ProjectsModule, StorageModule], controllers: [MediaController], providers: [MediaService] })
export class MediaModule {}
