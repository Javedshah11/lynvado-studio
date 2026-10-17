import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  type Project,
} from '@lynvado/database';

import {
  type CreateProjectInput,
  type UpdateProjectInput,
} from './projects.schema.js';

import {
  ProjectsRepository,
} from './projects.repository.js';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectsRepository:
      ProjectsRepository,
  ) {}

  async create(
    ownerId: string,
    input: CreateProjectInput,
  ): Promise<Project> {
    return this.projectsRepository.create({
      ownerId,
      name: input.name,
    });
  }

  async findAll(
    ownerId: string,
  ): Promise<Project[]> {
    return this.projectsRepository
      .findAllByOwner(
        ownerId,
      );
  }

  async findOne(
    ownerId: string,
    projectId: string,
  ): Promise<Project> {
    const project =
      await this.projectsRepository
        .findByIdAndOwner(
          projectId,
          ownerId,
        );

    if (!project) {
      throw new NotFoundException(
        'Project not found.',
      );
    }

    return project;
  }

  async update(
    ownerId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<Project> {
    const project =
      await this.projectsRepository
        .updateByIdAndOwner(
          projectId,
          ownerId,
          input,
        );

    if (!project) {
      throw new NotFoundException(
        'Project not found.',
      );
    }

    return project;
  }

  async remove(
    ownerId: string,
    projectId: string,
  ): Promise<void> {
    const project =
      await this.projectsRepository
        .deleteByIdAndOwner(
          projectId,
          ownerId,
        );

    if (!project) {
      throw new NotFoundException(
        'Project not found.',
      );
    }
  }
}
