import { Injectable } from '@nestjs/common';
import { eq, profiles, users } from '@lynvado/database';

import { DatabaseService } from '../database/database.service.js';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

export interface AuthUserRecord extends PublicUser {
  passwordHash: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const [result] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        displayName: profiles.displayName,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.email, email))
      .limit(1);

    return result ?? null;
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    const [result] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        displayName: profiles.displayName,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, id))
      .limit(1);

    return result ?? null;
  }

  async create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<PublicUser> {
    return this.database.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          passwordHash: input.passwordHash,
        })
        .returning({
          id: users.id,
          email: users.email,
          createdAt: users.createdAt,
        });

      if (!user) {
        throw new Error('Failed to create user');
      }

      const [profile] = await tx
        .insert(profiles)
        .values({
          userId: user.id,
          displayName: input.displayName,
        })
        .returning({ displayName: profiles.displayName });

      if (!profile) {
        throw new Error('Failed to create profile');
      }

      return {
        id: user.id,
        email: user.email,
        displayName: profile.displayName,
        createdAt: user.createdAt,
      };
    });
  }
}
