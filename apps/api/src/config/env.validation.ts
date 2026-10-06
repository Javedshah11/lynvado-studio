import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z
    .enum([
      'development',
      'test',
      'production',
    ])
    .default('development'),

  HOST: z
    .string()
    .min(1)
    .default('0.0.0.0'),

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
      'postgresql://lynvado:lynvado@localhost:5434/lynvado',
    ),

  REDIS_URL: z
    .string()
    .min(1)
    .default(
      'redis://localhost:6380',
    ),

  WEB_ORIGIN: z
    .string()
    .url()
    .default(
      'http://localhost:3000',
    ),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32),

  JWT_ACCESS_TTL_SECONDS:
    z.coerce
      .number()
      .int()
      .positive()
      .default(900),

  AUTH_REFRESH_TOKEN_TTL_DAYS:
    z.coerce
      .number()
      .int()
      .positive()
      .max(365)
      .default(30),

  AUTH_REFRESH_COOKIE_NAME:
    z.string()
      .trim()
      .min(1)
      .default(
        'lynvado_refresh',
      ),
});

export type EnvironmentVariables =
  z.infer<
    typeof environmentSchema
  >;

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const result =
    environmentSchema.safeParse(
      config,
    );

  if (!result.success) {
    const errors =
      result.error.issues
        .map((issue) => {
          const path =
            issue.path.join('.') ||
            'environment';

          return `${path}: ${issue.message}`;
        })
        .join('; ');

    throw new Error(
      `Environment validation failed: ${errors}`,
    );
  }

  return result.data;
}