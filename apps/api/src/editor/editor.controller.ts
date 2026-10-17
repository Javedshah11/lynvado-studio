import { BadRequestException, Body, Controller, Get, Param, Put, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { projectIdSchema } from '../projects/projects.schema.js';
import { EditorService } from './editor.service.js';
import { saveTimelineSchema } from './editor.schema.js';

@Controller('projects/:projectId/timeline')
@UseGuards(JwtAuthGuard)
export class EditorController {
  constructor(private readonly editorService: EditorService) {}

  @Get()
  get(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest) {
    return this.editorService.get(this.userId(request), this.projectId(projectId));
  }

  @Put()
  save(@Param('projectId') projectId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const parsed = saveTimelineSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(({ message }) => message).join(', '));
    return this.editorService.save(this.userId(request), this.projectId(projectId), parsed.data);
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
