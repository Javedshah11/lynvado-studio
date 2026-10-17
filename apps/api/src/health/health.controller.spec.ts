import { Test, TestingModule } from '@nestjs/testing';

import { HealthController } from './health.controller.js';
import { DatabaseService } from '../database/database.service.js';
import { ObjectStorage } from '../storage/object-storage.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          { provide: DatabaseService, useValue: { ping: vi.fn().mockResolvedValue(true) } },
          { provide: ObjectStorage, useValue: { ensureBucket: vi.fn().mockResolvedValue(undefined) } },
        ],
      }).compile();

    controller = module.get<HealthController>(
      HealthController,
    );
  });

  it('should report the API as healthy', () => {
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('lynvado-api');
    expect(result.version).toBe('0.1.0');
    expect(typeof result.uptimeSeconds).toBe('number');

    expect(
      Number.isNaN(Date.parse(result.timestamp)),
    ).toBe(false);
  });

  it('checks database and storage readiness', async () => {
    await expect(controller.getReadiness()).resolves.toEqual({
      status: 'ok', database: true, storage: true,
    });
  });
});
