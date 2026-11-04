import { Types } from 'mongoose';

/** Lowercase + trim (replaces PostgreSQL citext for emails). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Lowercase + trim for latin slugs (DTO pattern already enforces shape). */
export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

/**
 * Parses an id string into an ObjectId, or returns null when it is not a
 * valid id. Callers map null to 404 — never let a CastError become a 500.
 */
export function toObjectIdOrNull(id: string): Types.ObjectId | null {
  if (!Types.ObjectId.isValid(id)) return null;
  return new Types.ObjectId(id);
}

/** String form used at API boundaries (JWT claims, DTOs, responses). */
export function objectIdToString(id: Types.ObjectId | string): string {
  return typeof id === 'string' ? id : id.toHexString();
}
