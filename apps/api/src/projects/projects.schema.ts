import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      1,
      'Project name is required.',
    )
    .max(
      160,
      'Project name must be 160 characters or less.',
    ),
});

export const updateProjectSchema = createProjectSchema;

export const projectIdSchema =
  z.string().uuid(
    'Invalid project id.',
  );

export type CreateProjectInput =
  z.infer<
    typeof createProjectSchema
  >;

export type UpdateProjectInput =
  z.infer<
    typeof updateProjectSchema
  >;
