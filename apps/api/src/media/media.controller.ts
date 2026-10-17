import { BadRequestException, Controller, Get, Param, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
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
