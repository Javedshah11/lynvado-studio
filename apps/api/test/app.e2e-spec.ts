import { Test, TestingModule } from '@nestjs/testing';

import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import request from 'supertest';

import { AppModule } from '../src/app.module.js';

describe('Lynvado Studio API (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app =
      moduleFixture.createNestApplication<NestFastifyApplication>(
        new FastifyAdapter(),
      );

    app.setGlobalPrefix('api');

    await app.init();

    await app
      .getHttpAdapter()
      .getInstance()
      .ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/api')
      .expect(200);

    expect(response.body).toEqual({
      name: 'Lynvado Studio API',
      description:
        'Backend API for the Lynvado Studio AI video platform.',
      version: '0.1.0',
      status: 'running',
    });
  });

  it('GET /api/health', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');

    expect(response.body.service).toBe(
      'lynvado-api',
    );

    expect(response.body.version).toBe(
      '0.1.0',
    );

    expect(
      typeof response.body.uptimeSeconds,
    ).toBe('number');

    expect(
      Number.isNaN(
        Date.parse(response.body.timestamp),
      ),
    ).toBe(false);
  });
});
