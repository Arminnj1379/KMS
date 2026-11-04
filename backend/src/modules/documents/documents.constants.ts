/** Phase 5 limits for the two-step (intent → confirm) upload flow. */
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const UPLOAD_TTL_SECONDS = 900;
export const DOWNLOAD_TTL_SECONDS = 300;

/** Object keys are server-generated; this pattern also guards the local-upload route. */
export const OBJECT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,120}$/;

/**
 * Conservative allowlist (XSS/executable safe). `application/octet-stream`
 * is rejected on purpose — the client must declare a real type.
 */
export const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
]);
