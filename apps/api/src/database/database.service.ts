import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as schema from '@lynvado/database';
import { sql } from '@lynvado/database';
import {
  drizzle,
  type NodePgDatabase,
} from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  readonly db: NodePgDatabase<typeof schema>;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString:
        this.configService.getOrThrow<string>('DATABASE_URL'),
      max: this.configService.get<number>('DB_POOL_MAX') ?? 10,
      idleTimeoutMillis:
        this.configService.get<number>('DB_IDLE_TIMEOUT_MS') ?? 30000,
      connectionTimeoutMillis:
        this.configService.get<number>('DB_CONNECTION_TIMEOUT_MS') ??
        5000,
    });

    this.db = drizzle({ client: this.pool, schema });
  }

  async ping(): Promise<boolean> {
    await this.db.execute(sql`select 1`);
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
