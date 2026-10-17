import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnvironment } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { TranscriptsModule } from './transcripts/transcripts.module.js';
import { ContentModule } from './content/content.module.js';
import { EditorModule } from './editor/editor.module.js';
import { MediaModule } from './media/media.module.js';
import { ExportsModule } from './exports/exports.module.js';
import { AiEditModule } from './ai-edit/ai-edit.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,

      envFilePath: [
        '.env',
        '../../.env',
      ],

      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    DatabaseModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    StorageModule,
    UploadsModule,
    TranscriptsModule,
    ContentModule,
    EditorModule,
    MediaModule,
    ExportsModule,
    AiEditModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
