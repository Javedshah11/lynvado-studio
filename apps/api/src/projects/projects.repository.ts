import { Injectable } from '@nestjs/common';

import {
  and,
  desc,
  eq,
} from 'drizzle-orm';

import {
  projects,
  type Project,
} from '@lynvado/database';

import {
  DatabaseService,
} from '../database/database.service.js';

interface CreateProjectInput {
  ownerId: string;
  name: string;
}

interface UpdateProjectInput {
  name: string;
}

@Injectable()
export class ProjectsRepository {
  constructor(
    private readonly database:
      DatabaseService,
  ) {}

  async create(
    input: CreateProjectInput,
  ): Promise<Project> {
    const [project] =
      await this.database.db
        .insert(projects)
        .values({
          ownerId:
            input.ownerId,
          name:
            input.name,
          status:
            'draft',
        })
        .returning();

    if (!project) {
      throw new Error(
        'Failed to create project.',
      );
    }

    return project;
  }

  async findAllByOwner(
    ownerId: string,
  ): Promise<Project[]> {
    return this.database.db
      .select()
      .from(projects)
      .where(
        eq(
          projects.ownerId,
          ownerId,
        ),
      )
      .orderBy(
        desc(
          projects.createdAt,
        ),
      );
  }

  async findByIdAndOwner(
    projectId: string,
    ownerId: string,
  ): Promise<Project | null> {
    const [project] =
      await this.database.db
        .select()
        .from(projects)
        .where(
          and(
            eq(
              projects.id,
              projectId,
            ),
            eq(
              projects.ownerId,
              ownerId,
            ),
          ),
        )
        .limit(1);

    return project ?? null;
  }

  async updateByIdAndOwner(
    projectId: string,
    ownerId: string,
    input: UpdateProjectInput,
  ): Promise<Project | null> {
    const [project] =
      await this.database.db
        .update(projects)
        .set({
          name: input.name,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.ownerId, ownerId),
          ),
        )
        .returning();

    return project ?? null;
  }

  async deleteByIdAndOwner(
    projectId: string,
    ownerId: string,
  ): Promise<Project | null> {
    const [project] =
      await this.database.db
        .delete(projects)
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.ownerId, ownerId),
          ),
        )
        .returning();

    return project ?? null;
  }
}
