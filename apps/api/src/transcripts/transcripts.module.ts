import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { TranscriptsController } from './transcripts.controller.js';
import { TranscriptsService } from './transcripts.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, ProjectsModule],
  controllers: [TranscriptsController],
  providers: [TranscriptsService],
})
export class TranscriptsModule {}
