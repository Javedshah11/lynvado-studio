import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly configService:
      ConfigService,
  ) {}

  generate(): string {
    return randomBytes(48).toString(
      'base64url',
    );
  }

  hash(token: string): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }

  createExpiresAt(): Date {
    const expiresAt = new Date();

    expiresAt.setUTCDate(
      expiresAt.getUTCDate() +
        this.getTtlDays(),
    );

    return expiresAt;
  }

  getTtlDays(): number {
    return (
      this.configService.get<number>(
        'AUTH_REFRESH_TOKEN_TTL_DAYS',
      ) ?? 30
    );
  }

  getTtlSeconds(): number {
    return (
      this.getTtlDays() *
      24 *
      60 *
      60
    );
  }
}