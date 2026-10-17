import { BadRequestException, Controller, Get, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { projectIdSchema } from '../projects/projects.schema.js';
import { MediaService } from './media.service.js';

@Controller('projects/:projectId/media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}
  @Get()
  list(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest) {
    const parsed = projectIdSchema.safeParse(projectId);
    if (!parsed.success) throw new BadRequestException('Invalid project id.');
    if (!request.authUser) throw new UnauthorizedException('Authentication required.');
    return this.mediaService.list(request.authUser.userId, parsed.data);
  }
}

@Controller('projects/:projectId/jobs')
@UseGuards(JwtAuthGuard)
export class ProcessingJobsController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  list(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest) {
    const parsed = projectIdSchema.safeParse(projectId);
    if (!parsed.success) throw new BadRequestException('Invalid project id.');
    if (!request.authUser) throw new UnauthorizedException('Authentication required.');
    return this.mediaService.listJobs(request.authUser.userId, parsed.data);
  }

  @Post(':jobId/retry')
  retry(
    @Param('projectId') projectId: string,
    @Param('jobId') jobId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsedProject = projectIdSchema.safeParse(projectId);
    const parsedJob = z.string().uuid().safeParse(jobId);
    if (!parsedProject.success || !parsedJob.success) {
      throw new BadRequestException('Invalid processing job id.');
    }
    if (!request.authUser) throw new UnauthorizedException('Authentication required.');
    return this.mediaService.retryIngestion(
      request.authUser.userId,
      parsedProject.data,
      parsedJob.data,
    );
  }
}
