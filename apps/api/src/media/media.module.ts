import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { MediaController, ProcessingJobsController } from './media.controller.js';
import { MediaService } from './media.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, ProjectsModule, StorageModule, UploadsModule],
  controllers: [MediaController, ProcessingJobsController],
  providers: [MediaService],
})
export class MediaModule {}
