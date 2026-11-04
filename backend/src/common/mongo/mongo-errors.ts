import { ConflictException } from '@nestjs/common';

/** MongoDB duplicate-key error (unique index violation). Replaces Prisma P2002. */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

/** Maps E11000 to 409 Conflict, rethrows everything else (never leak driver errors). */
export function throwConflictIfDuplicate(error: unknown, message: string): never {
  if (isDuplicateKeyError(error)) throw new ConflictException(message);
  throw error;
}
