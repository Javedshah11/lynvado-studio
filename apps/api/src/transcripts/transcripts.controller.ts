import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth.guard.js';
import { projectIdSchema } from '../projects/projects.schema.js';
import { TranscriptsService } from './transcripts.service.js';

@Controller('projects/:projectId/transcript')
@UseGuards(JwtAuthGuard)
export class TranscriptsController {
  constructor(private readonly transcriptsService: TranscriptsService) {}

  @Get()
  async findOne(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException('Authentication required.');
    }
    const parsed = projectIdSchema.safeParse(projectId);
    if (!parsed.success) throw new BadRequestException('Invalid project id.');

    return this.transcriptsService.findForProject(
      request.authUser.userId,
      parsed.data,
    );
  }
}
