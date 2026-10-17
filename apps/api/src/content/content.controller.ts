import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth.guard.js';
import { projectIdSchema } from '../projects/projects.schema.js';
import { ContentService } from './content.service.js';

const entityIdSchema = z.string().uuid();
const captionUpdateSchema = z.object({ text: z.string().trim().min(1).max(500) });
const clipStatusSchema = z.object({
  status: z.enum(['suggested', 'accepted', 'rejected']),
});

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('captions')
  getCaptions(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.contentService.getCaptions(this.userId(request), this.projectId(projectId));
  }

  @Patch('captions/:segmentId')
  updateCaption(
    @Param('projectId') projectId: string,
    @Param('segmentId') segmentId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsedBody = captionUpdateSchema.safeParse(body);
    const parsedSegment = entityIdSchema.safeParse(segmentId);
    if (!parsedBody.success || !parsedSegment.success) {
      throw new BadRequestException('Invalid caption update.');
    }
    return this.contentService.updateCaption(
      this.userId(request),
      this.projectId(projectId),
      parsedSegment.data,
      parsedBody.data.text,
    );
  }

  @Get('clips')
  getClips(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.contentService.getClips(this.userId(request), this.projectId(projectId));
  }

  @Patch('clips/:clipId')
  updateClip(
    @Param('projectId') projectId: string,
    @Param('clipId') clipId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsedBody = clipStatusSchema.safeParse(body);
    const parsedClip = entityIdSchema.safeParse(clipId);
    if (!parsedBody.success || !parsedClip.success) {
      throw new BadRequestException('Invalid clip update.');
    }
    return this.contentService.updateClipStatus(
      this.userId(request),
      this.projectId(projectId),
      parsedClip.data,
      parsedBody.data.status,
    );
  }

  private projectId(value: string): string {
    const parsed = projectIdSchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException('Invalid project id.');
    return parsed.data;
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.authUser) throw new UnauthorizedException('Authentication required.');
    return request.authUser.userId;
  }
}
