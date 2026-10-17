import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth.guard.js';
import { projectIdSchema } from '../projects/projects.schema.js';
import {
  completeUploadSchema,
  initializeUploadSchema,
} from './uploads.schema.js';
import { UploadsService } from './uploads.service.js';

@Controller('projects/:projectId/uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('init')
  async initialize(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const ownerId = this.getUserId(request);
    const parsedProjectId = projectIdSchema.safeParse(projectId);
    const parsedBody = initializeUploadSchema.safeParse(body);

    if (!parsedProjectId.success) {
      throw new BadRequestException('Invalid project id.');
    }
    if (!parsedBody.success) {
      throw new BadRequestException({
        message: 'Invalid upload data.',
        errors: parsedBody.error.flatten(),
      });
    }

    return this.uploadsService.initialize(
      ownerId,
      parsedProjectId.data,
      parsedBody.data,
    );
  }

  @Post('complete')
  async complete(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const ownerId = this.getUserId(request);
    const parsedProjectId = projectIdSchema.safeParse(projectId);
    const parsedBody = completeUploadSchema.safeParse(body);

    if (!parsedProjectId.success) {
      throw new BadRequestException('Invalid project id.');
    }
    if (!parsedBody.success) {
      throw new BadRequestException({
        message: 'Invalid upload completion data.',
        errors: parsedBody.error.flatten(),
      });
    }

    return this.uploadsService.complete(
      ownerId,
      parsedProjectId.data,
      parsedBody.data.uploadId,
    );
  }

  private getUserId(request: AuthenticatedRequest): string {
    if (!request.authUser) {
      throw new UnauthorizedException('Authentication required.');
    }
    return request.authUser.userId;
  }
}
