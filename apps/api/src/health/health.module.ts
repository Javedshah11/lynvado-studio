import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [HealthController],
})
export class HealthModule {}
