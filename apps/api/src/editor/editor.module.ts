import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { EditorController } from './editor.controller.js';
import { EditorService } from './editor.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, ProjectsModule],
  controllers: [EditorController],
  providers: [EditorService],
  exports: [EditorService],
})
export class EditorModule {}
