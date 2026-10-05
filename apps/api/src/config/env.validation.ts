import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  HOST: z.string().min(1).default('0.0.0.0'),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(4000),

  DATABASE_URL: z
    .string()
    .min(1)
    .default(
      'postgresql://lynvado:lynvado@localhost:5432/lynvado',
    ),

  REDIS_URL: z
    .string()
    .min(1)
    .default('redis://localhost:6379'),
});

export type EnvironmentVariables = z.infer<
  typeof environmentSchema
>;

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => {
        const path = issue.path.join('.') || 'environment';

        return `${path}: ${issue.message}`;
      })
      .join('; ');

    throw new Error(
      `Environment validation failed: ${errors}`,
    );
  }

  return result.data;
}