import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth.guard.js';

import {
  createProjectSchema,
  projectIdSchema,
  updateProjectSchema,
} from './projects.schema.js';

import {
  ProjectsService,
} from './projects.service.js';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService:
      ProjectsService,
  ) {}

  @Post()
  async create(
    @Body()
    body: unknown,

    @Req()
    request: AuthenticatedRequest,
  ) {
    const userId =
      this.getUserId(
        request,
      );

    const parsed =
      createProjectSchema.safeParse(
        body,
      );

    if (!parsed.success) {
      throw new BadRequestException({
        message:
          'Invalid project data.',
        errors:
          parsed.error.flatten(),
      });
    }

    return this.projectsService.create(
      userId,
      parsed.data,
    );
  }

  @Get()
  async findAll(
    @Req()
    request: AuthenticatedRequest,
  ) {
    const userId =
      this.getUserId(
        request,
      );

    return this.projectsService.findAll(
      userId,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id')
    id: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    const userId =
      this.getUserId(
        request,
      );

    const parsed =
      projectIdSchema.safeParse(
        id,
      );

    if (!parsed.success) {
      throw new BadRequestException(
        'Invalid project id.',
      );
    }

    return this.projectsService.findOne(
      userId,
      parsed.data,
    );
  }

  @Patch(':id')
  async update(
    @Param('id')
    id: string,

    @Body()
    body: unknown,

    @Req()
    request: AuthenticatedRequest,
  ) {
    const userId = this.getUserId(request);
    const parsedId = projectIdSchema.safeParse(id);
    const parsedBody = updateProjectSchema.safeParse(body);

    if (!parsedId.success) {
      throw new BadRequestException('Invalid project id.');
    }

    if (!parsedBody.success) {
      throw new BadRequestException({
        message: 'Invalid project data.',
        errors: parsedBody.error.flatten(),
      });
    }

    return this.projectsService.update(
      userId,
      parsedId.data,
      parsedBody.data,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id')
    id: string,

    @Req()
    request: AuthenticatedRequest,
  ): Promise<void> {
    const userId = this.getUserId(request);
    const parsed = projectIdSchema.safeParse(id);

    if (!parsed.success) {
      throw new BadRequestException('Invalid project id.');
    }

    await this.projectsService.remove(
      userId,
      parsed.data,
    );
  }

  private getUserId(
    request: AuthenticatedRequest,
  ): string {
    if (!request.authUser) {
      throw new UnauthorizedException(
        'Authentication required.',
      );
    }

    return request.authUser.userId;
  }
}
