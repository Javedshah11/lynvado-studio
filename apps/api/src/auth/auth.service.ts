import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import {
  type LoginInput,
  type RegisterInput,
} from './auth.schemas.js';

import {
  type PublicUser,
  UsersRepository,
} from '../users/users.repository.js';

import {
  type AuthSessionContext,
} from './auth-session-context.js';

import {
  AuthSessionRepository,
} from './auth-session.repository.js';

import {
  RefreshTokenService,
} from './refresh-token.service.js';

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}

export interface AuthSessionResponse
  extends AuthResponse {
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository:
      UsersRepository,

    private readonly jwtService:
      JwtService,

    private readonly authSessionRepository:
      AuthSessionRepository,

    private readonly refreshTokenService:
      RefreshTokenService,
  ) {}

  async register(
    input: RegisterInput,
    context: AuthSessionContext,
  ): Promise<AuthSessionResponse> {
    const email =
      input.email
        .trim()
        .toLowerCase();

    const existing =
      await this.usersRepository.findByEmail(
        email,
      );

    if (existing) {
      throw new ConflictException(
        'An account with this email already exists.',
      );
    }

    const passwordHash =
      await argon2.hash(
        input.password,
        {
          type: argon2.argon2id,
        },
      );

    let user: PublicUser;

    try {
      user =
        await this.usersRepository.create({
          email,

          passwordHash,

          displayName:
            input.displayName.trim(),
        });
    } catch (error) {
      if (
        this.isUniqueViolation(error)
      ) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }

      throw error;
    }

    return this.createSession(
      user,
      context,
    );
  }

  async login(
    input: LoginInput,
    context: AuthSessionContext,
  ): Promise<AuthSessionResponse> {
    const email =
      input.email
        .trim()
        .toLowerCase();

    const user =
      await this.usersRepository.findByEmail(
        email,
      );

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      );
    }

    const validPassword =
      await argon2.verify(
        user.passwordHash,
        input.password,
      );

    if (!validPassword) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      );
    }

    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,

      displayName:
        user.displayName,

      createdAt:
        user.createdAt,
    };

    return this.createSession(
      publicUser,
      context,
    );
  }

  async refresh(
    refreshToken: string,
    context: AuthSessionContext,
  ): Promise<AuthSessionResponse> {
    const currentRefreshTokenHash =
      this.refreshTokenService.hash(
        refreshToken,
      );

    const session =
      await this.authSessionRepository
        .findActiveByRefreshTokenHash(
          currentRefreshTokenHash,
        );

    if (!session) {
      throw new UnauthorizedException(
        'Invalid or expired refresh session.',
      );
    }

    const user =
      await this.usersRepository
        .findPublicById(
          session.userId,
        );

    if (!user) {
      throw new UnauthorizedException(
        'User account no longer exists.',
      );
    }

    const nextRefreshToken =
      this.refreshTokenService.generate();

    const nextRefreshTokenHash =
      this.refreshTokenService.hash(
        nextRefreshToken,
      );

    const rotatedSession =
      await this.authSessionRepository.rotate(
        {
          sessionId:
            session.id,

          currentRefreshTokenHash,

          nextRefreshTokenHash,

          expiresAt:
            this.refreshTokenService
              .createExpiresAt(),

          userAgent:
            context.userAgent,

          ipAddress:
            context.ipAddress,
        },
      );

    if (!rotatedSession) {
      throw new UnauthorizedException(
        'Refresh session has already been used.',
      );
    }

    return {
      user,

      accessToken:
        await this.createAccessToken(
          user,
        ),

      refreshToken:
        nextRefreshToken,
    };
  }

  async logout(
    refreshToken: string,
  ): Promise<void> {
    const refreshTokenHash =
      this.refreshTokenService.hash(
        refreshToken,
      );

    await this.authSessionRepository
      .revokeByRefreshTokenHash(
        refreshTokenHash,
      );
  }

  async getMe(
    userId: string,
  ): Promise<PublicUser> {
    const user =
      await this.usersRepository
        .findPublicById(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  private async createSession(
    user: PublicUser,
    context: AuthSessionContext,
  ): Promise<AuthSessionResponse> {
    const refreshToken =
      this.refreshTokenService.generate();

    const refreshTokenHash =
      this.refreshTokenService.hash(
        refreshToken,
      );

    await this.authSessionRepository.create({
      userId: user.id,

      refreshTokenHash,

      expiresAt:
        this.refreshTokenService
          .createExpiresAt(),

      userAgent:
        context.userAgent,

      ipAddress:
        context.ipAddress,
    });

    return {
      user,

      accessToken:
        await this.createAccessToken(
          user,
        ),

      refreshToken,
    };
  }

  private async createAccessToken(
    user: PublicUser,
  ): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
  }

  private isUniqueViolation(
    error: unknown,
  ): boolean {
    if (
      typeof error !== 'object' ||
      error === null
    ) {
      return false;
    }

    return (
      'code' in error &&
      error.code === '23505'
    );
  }
}
