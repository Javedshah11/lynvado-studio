import { BadRequestException, Controller, Get, Headers, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { projectIdSchema } from '../projects/projects.schema.js';
import { ExportsService } from './exports.service.js';

@Controller('projects/:projectId/exports')
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsedKey = z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/).safeParse(idempotencyKey);
    if (!parsedKey.success) throw new BadRequestException('A valid Idempotency-Key header is required.');
    return this.exportsService.create(this.userId(request), this.projectId(projectId), parsedKey.data);
  }

  @Get()
  list(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest) {
    return this.exportsService.list(this.userId(request), this.projectId(projectId));
  }

  @Get(':jobId/download')
  download(@Param('projectId') projectId: string, @Param('jobId') jobId: string, @Req() request: AuthenticatedRequest) {
    const parsedJob = z.string().uuid().safeParse(jobId);
    if (!parsedJob.success) throw new BadRequestException('Invalid export id.');
    return this.exportsService.download(this.userId(request), this.projectId(projectId), parsedJob.data);
  }

  private projectId(value: string) {
    const parsed = projectIdSchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException('Invalid project id.');
    return parsed.data;
  }
  private userId(request: AuthenticatedRequest) {
    if (!request.authUser) throw new UnauthorizedException('Authentication required.');
    return request.authUser.userId;
  }
}
