import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import type { PublicUser } from '../users/users.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const existing = await this.usersRepository.findByEmail(email);

    if (existing) {
      throw new ConflictException(
        'An account with this email already exists.',
      );
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

    let user: PublicUser;

    try {
      user = await this.usersRepository.create({
        email,
        passwordHash,
        displayName: input.displayName.trim(),
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }

      throw error;
    }

    return {
      user,
      accessToken: await this.createAccessToken(user),
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const user = await this.usersRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const validPassword = await argon2.verify(
      user.passwordHash,
      input.password,
    );

    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };

    return {
      user: publicUser,
      accessToken: await this.createAccessToken(publicUser),
    };
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.usersRepository.findPublicById(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  private async createAccessToken(user: PublicUser): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
