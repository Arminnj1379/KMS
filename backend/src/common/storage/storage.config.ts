import { z } from 'zod';

/**
 * Storage configuration subset. Parsed from `process.env` so the storage
 * layer works without the full app env (unit tests, scripts). The full
 * schema in `config/env.ts` mirrors these fields for bootstrap validation.
 */
const storageEnvSchema = z.object({
  STORAGE_DRIVER: z.enum(['s3', 'local']).default('s3'),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().default('kms-docs'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  UPLOADS_DIR: z.string().default('./uploads'),
  API_PREFIX: z.string().default('api'),
});

export type StorageConfig = z.infer<typeof storageEnvSchema>;

export function parseStorageConfig(raw: Record<string, unknown>): StorageConfig {
  const parsed = storageEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid storage configuration: ${details}`);
  }
  return parsed.data;
}
