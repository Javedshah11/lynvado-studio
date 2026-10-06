import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import type {
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import {
  loginSchema,
  registerSchema,
} from './auth.schemas.js';

import {
  AuthService,
} from './auth.service.js';

import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from './jwt-auth.guard.js';

import {
  type AuthSessionContext,
} from './auth-session-context.js';

import {
  RefreshTokenService,
} from './refresh-token.service.js';

@Controller('auth')
export class AuthController {
  private readonly refreshCookieName:
    string;

  constructor(
    private readonly authService:
      AuthService,

    private readonly configService:
      ConfigService,

    private readonly refreshTokenService:
      RefreshTokenService,
  ) {
    this.refreshCookieName =
      this.configService.get<string>(
        'AUTH_REFRESH_COOKIE_NAME',
      ) ?? 'lynvado_refresh';
  }

  @Post('register')
  async register(
    @Body()
    body: unknown,

    @Req()
    request: FastifyRequest,

    @Res({
      passthrough: true,
    })
    reply: FastifyReply,
  ) {
    const parsed =
      registerSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        message:
          'Invalid registration data.',

        errors:
          parsed.error.flatten(),
      });
    }

    const result =
      await this.authService.register(
        parsed.data,

        this.getSessionContext(
          request,
        ),
      );

    this.setRefreshCookie(
      reply,
      result.refreshToken,
    );

    return {
      user: result.user,
      accessToken:
        result.accessToken,
    };
  }

  @Post('login')
  async login(
    @Body()
    body: unknown,

    @Req()
    request: FastifyRequest,

    @Res({
      passthrough: true,
    })
    reply: FastifyReply,
  ) {
    const parsed =
      loginSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        message:
          'Invalid login data.',

        errors:
          parsed.error.flatten(),
      });
    }

    const result =
      await this.authService.login(
        parsed.data,

        this.getSessionContext(
          request,
        ),
      );

    this.setRefreshCookie(
      reply,
      result.refreshToken,
    );

    return {
      user: result.user,
      accessToken:
        result.accessToken,
    };
  }

  @Post('refresh')
  async refresh(
    @Req()
    request: FastifyRequest,

    @Res({
      passthrough: true,
    })
    reply: FastifyReply,
  ) {
    const refreshToken =
      request.cookies[
        this.refreshCookieName
      ];

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Refresh session not found.',
      );
    }

    const result =
      await this.authService.refresh(
        refreshToken,

        this.getSessionContext(
          request,
        ),
      );

    this.setRefreshCookie(
      reply,
      result.refreshToken,
    );

    return {
      user: result.user,
      accessToken:
        result.accessToken,
    };
  }

  @Post('logout')
  async logout(
    @Req()
    request: FastifyRequest,

    @Res({
      passthrough: true,
    })
    reply: FastifyReply,
  ) {
    const refreshToken =
      request.cookies[
        this.refreshCookieName
      ];

    if (refreshToken) {
      await this.authService.logout(
        refreshToken,
      );
    }

    this.clearRefreshCookie(
      reply,
    );

    return {
      success: true,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @Req()
    request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new BadRequestException();
    }

    return this.authService.getMe(
      request.authUser.userId,
    );
  }

  private getSessionContext(
    request: FastifyRequest,
  ): AuthSessionContext {
    return {
      userAgent:
        request.headers[
          'user-agent'
        ] ?? null,

      ipAddress:
        request.ip ?? null,
    };
  }

  private setRefreshCookie(
    reply: FastifyReply,
    refreshToken: string,
  ): void {
    reply.setCookie(
      this.refreshCookieName,
      refreshToken,
      {
        httpOnly: true,

        secure:
          this.configService.get<string>(
            'NODE_ENV',
          ) === 'production',

        sameSite: 'lax',

        path: '/api/auth',

        maxAge:
          this.refreshTokenService
            .getTtlSeconds(),
      },
    );
  }

  private clearRefreshCookie(
    reply: FastifyReply,
  ): void {
    reply.clearCookie(
      this.refreshCookieName,
      {
        httpOnly: true,

        secure:
          this.configService.get<string>(
            'NODE_ENV',
          ) === 'production',

        sameSite: 'lax',

        path: '/api/auth',
      },
    );
  }
}
