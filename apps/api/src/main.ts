import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app =
    await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
    );

  const configService =
    app.get(ConfigService);

  const port =
    configService.get<number>('PORT') ?? 4000;

  const host =
    configService.get<string>('HOST') ??
    '0.0.0.0';

  const webOrigin =
    configService.get<string>('WEB_ORIGIN') ??
    'http://localhost:3000';

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');

  logger.log(
    `Lynvado Studio API running on http://localhost:${port}/api`,
  );
}

void bootstrap();
