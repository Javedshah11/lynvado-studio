import { Injectable } from '@nestjs/common';

import {
  and,
  eq,
  gt,
  isNull,
} from 'drizzle-orm';

import {
  authSessions,
  type AuthSession,
} from '@lynvado/database';

import { DatabaseService } from '../database/database.service.js';

interface CreateSessionInput {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

interface RotateSessionInput {
  sessionId: string;
  currentRefreshTokenHash: string;
  nextRefreshTokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

@Injectable()
export class AuthSessionRepository {
  constructor(
    private readonly database:
      DatabaseService,
  ) {}

  async create(
    input: CreateSessionInput,
  ): Promise<AuthSession> {
    const [session] =
      await this.database.db
        .insert(authSessions)
        .values({
          userId: input.userId,

          refreshTokenHash:
            input.refreshTokenHash,

          expiresAt: input.expiresAt,

          userAgent:
            input.userAgent,

          ipAddress:
            input.ipAddress,
        })
        .returning();

    if (!session) {
      throw new Error(
        'Failed to create authentication session.',
      );
    }

    return session;
  }

  async findActiveByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<AuthSession | null> {
    const [session] =
      await this.database.db
        .select()
        .from(authSessions)
        .where(
          and(
            eq(
              authSessions.refreshTokenHash,
              refreshTokenHash,
            ),

            isNull(
              authSessions.revokedAt,
            ),

            gt(
              authSessions.expiresAt,
              new Date(),
            ),
          ),
        )
        .limit(1);

    return session ?? null;
  }

  async rotate(
    input: RotateSessionInput,
  ): Promise<AuthSession | null> {
    const [session] =
      await this.database.db
        .update(authSessions)
        .set({
          refreshTokenHash:
            input.nextRefreshTokenHash,

          expiresAt:
            input.expiresAt,

          userAgent:
            input.userAgent,

          ipAddress:
            input.ipAddress,

          updatedAt:
            new Date(),
        })
        .where(
          and(
            eq(
              authSessions.id,
              input.sessionId,
            ),

            eq(
              authSessions.refreshTokenHash,
              input.currentRefreshTokenHash,
            ),

            isNull(
              authSessions.revokedAt,
            ),

            gt(
              authSessions.expiresAt,
              new Date(),
            ),
          ),
        )
        .returning();

    return session ?? null;
  }

  async revokeByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<void> {
    await this.database.db
      .update(authSessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(
            authSessions.refreshTokenHash,
            refreshTokenHash,
          ),

          isNull(
            authSessions.revokedAt,
          ),
        ),
      );
  }
}
