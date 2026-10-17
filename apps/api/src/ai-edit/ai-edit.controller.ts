import { BadRequestException, Body, Controller, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { projectIdSchema } from '../projects/projects.schema.js';
import { AiEditService } from './ai-edit.service.js';
import { aiEditRequestSchema } from './ai-edit.schema.js';

@Controller('projects/:projectId/ai-edit')
@UseGuards(JwtAuthGuard)
export class AiEditController {
  constructor(private readonly service: AiEditService) {}
  @Post()
  edit(@Param('projectId') projectId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const project = projectIdSchema.safeParse(projectId);
    const input = aiEditRequestSchema.safeParse(body);
    if (!project.success || !input.success) throw new BadRequestException('Invalid AI editing request.');
    if (!request.authUser) throw new UnauthorizedException('Authentication required.');
    return this.service.edit(request.authUser.userId, project.data, input.data);
  }
}
