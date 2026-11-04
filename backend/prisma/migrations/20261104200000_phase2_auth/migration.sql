-- Phase 2: sessions.refresh_hash unique (refresh rotation lookup), departments.description
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_refresh_hash_key" UNIQUE ("refresh_hash");
