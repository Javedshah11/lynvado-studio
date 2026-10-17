import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EditorModule } from '../editor/editor.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { AiEditController } from './ai-edit.controller.js';
import { AiEditService } from './ai-edit.service.js';

@Module({ imports: [AuthModule, DatabaseModule, EditorModule, ProjectsModule], controllers: [AiEditController], providers: [AiEditService] })
export class AiEditModule {}
