import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ContentController } from './content.controller.js';
import { ContentService } from './content.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, ProjectsModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
