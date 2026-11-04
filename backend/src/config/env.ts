import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { z } from 'zod';

// Load local .env files for developer convenience (docker/compose and CI pass
// real environment variables, which dotenv never overrides). Candidate paths
// cover both `npm --workspace` (cwd=repo root) and direct backend/ runs.
for (const candidate of ['.env', '../.env']) {
  dotenv.config({ path: path.resolve(process.cwd(), candidate) });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('api'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().default('kms-docs'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  STORAGE_DRIVER: z.enum(['s3', 'local']).default('s3'),
  UPLOADS_DIR: z.string().default('./uploads'),
});

export type AppEnv = z.infer<typeof envSchema> & { corsOrigins: string[] };

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  const corsOrigins = parsed.data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { ...parsed.data, corsOrigins };
}
