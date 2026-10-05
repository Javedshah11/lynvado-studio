import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { loginSchema, registerSchema } from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid registration data.',
        errors: parsed.error.flatten(),
      });
    }

    return this.authService.register(parsed.data);
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid login data.',
        errors: parsed.error.flatten(),
      });
    }

    return this.authService.login(parsed.data);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    if (!request.authUser) {
      throw new BadRequestException();
    }

    return this.authService.getMe(request.authUser.userId);
  }
}
