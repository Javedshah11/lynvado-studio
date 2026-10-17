import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ExportQueueService } from './export-queue.service.js';
import { ExportsController } from './exports.controller.js';
import { ExportsService } from './exports.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, ProjectsModule, StorageModule],
  controllers: [ExportsController],
  providers: [ExportsService, ExportQueueService],
})
export class ExportsModule {}
