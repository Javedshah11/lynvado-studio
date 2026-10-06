import { Module } from '@nestjs/common';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import {
  JwtModule,
} from '@nestjs/jwt';

import {
  AuthController,
} from './auth.controller.js';

import {
  AuthService,
} from './auth.service.js';

import {
  JwtAuthGuard,
} from './jwt-auth.guard.js';

import {
  AuthSessionRepository,
} from './auth-session.repository.js';

import {
  RefreshTokenService,
} from './refresh-token.service.js';

import {
  DatabaseModule,
} from '../database/database.module.js';

import {
  UsersModule,
} from '../users/users.module.js';

@Module({
  imports: [
    ConfigModule,

    DatabaseModule,

    UsersModule,

    JwtModule.registerAsync({
      imports: [
        ConfigModule,
      ],

      inject: [
        ConfigService,
      ],

      useFactory: (
        configService:
          ConfigService,
      ) => ({
        secret:
          configService
            .getOrThrow<string>(
              'JWT_ACCESS_SECRET',
            ),

        signOptions: {
          expiresIn:
            configService.get<number>(
              'JWT_ACCESS_TTL_SECONDS',
            ) ?? 900,

          issuer:
            'lynvado-api',

          audience:
            'lynvado-web',
        },
      }),
    }),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,

    JwtAuthGuard,

    AuthSessionRepository,

    RefreshTokenService,
  ],
})
export class AuthModule {}
