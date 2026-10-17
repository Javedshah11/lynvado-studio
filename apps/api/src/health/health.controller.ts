import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { ObjectStorage } from '../storage/object-storage.js';

interface HealthResponse {
  status: 'ok';
  service: 'lynvado-api';
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: ObjectStorage,
  ) {}

  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'lynvado-api',
      version: '0.1.0',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async getReadiness() {
    const database = await this.database.ping();
    await this.storage.ensureBucket();
    return { status: 'ok' as const, database, storage: true };
  }
}
