import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { IngestionQueueService } from './ingestion-queue.service.js';
import { UploadsController } from './uploads.controller.js';
import { UploadsRepository } from './uploads.repository.js';
import { UploadsService } from './uploads.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, ProjectsModule, StorageModule],
  controllers: [UploadsController],
  providers: [UploadsRepository, UploadsService, IngestionQueueService],
  exports: [IngestionQueueService],
})
export class UploadsModule {}
