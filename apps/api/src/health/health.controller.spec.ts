import { Test, TestingModule } from '@nestjs/testing';

import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [HealthController],
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
});
