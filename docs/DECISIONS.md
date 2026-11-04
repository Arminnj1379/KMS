# Decisions (ADR-lite)

## D-001 Modular monolith over microservices — 2026-11-04
Context: Small team, single deployable, strong consistency needs (article publish + version + audit in one tx).
Decision: NestJS modules with explicit public-service contracts; one Postgres; one deployable.
Consequences: No network boundaries; must enforce module rules in review. Revisit if team >3 or independent scaling proven necessary.

## D-002 Prisma over TypeORM/MikroORM — 2026-11-04
Context: Need strict TS types, reliable migrations, low boilerplate.
Decision: Prisma 5 + `migrate deploy`. Raw SQL only for extensions/FTS columns.
Consequences: No generic repositories; per-module `*.repository.ts` thin wrappers.

## D-003 Tiptap JSON as source of truth — 2026-11-04
Context: Rich text must be versionable, renderable, searchable.
Decision: Store `contentJson` (Tiptap doc) + derived `contentText` (search) + `contentHtml` (sanitized cache). Validate with Zod on write.
Consequences: HTML never trusted from client; server sanitizes render cache.

## D-004 PostgreSQL FTS first, Elasticsearch later — 2026-11-04
Context: No scale evidence for ES ops cost.
Decision: `tsvector GENERATED` + pg_trgm; `SearchService` interface swappable.
Consequences: Search relevance simpler; ES can be added behind same token.

## D-005 Sync notifications/audit, no broker — 2026-11-04
Context: No throughput requirement justifying RabbitMQ.
Decision: In-process emitter + append-only audit in request scope (non-blocking failure).
Consequences: Document async seam (`NotificationsPort`, `AuditService`) for future BullMQ/RabbitMQ.

## D-006 Refresh = opaque rotated tokens in DB — 2026-11-04
Context: JWT refresh reuse attacks.
Decision: Opaque 32B random, sha256 stored, family rotation, reuse revokes family.
Consequences: DB lookup per refresh; Redis cache may be added later (justified then).

## D-007 MinIO (S3-compatible) for objects — 2026-11-04
Context: Need presigned uploads without public buckets; AWS parity.
Decision: AWS SDK v3 against MinIO in dev/compose; config switch to AWS in prod.
Consequences: `StorageService` abstraction; bucket private; TTL 5–15 min.

## D-008 Persian RTL default, i18n-keyed — 2026-11-04
Context: Requirement: fa-IR RTL default, extensible to en.
Decision: `i18n/fa.json` canonical, `en.json` skeleton; `dir` from locale; Vazirmatn font; Jalali dates via ` Intl.DateTimeFormat('fa-IR')` + `jalaali-js` where needed.
Consequences: No hardcoded Persian strings in components — use `t()` from day one (enforced in review; skeleton in Phase 1, full coverage by Phase 9).

## D-009 No Redis in MVP — 2026-11-04
Context: Caching/rate-limit could use Redis but adds ops.
Decision: In-memory rate-limit + DB sessions for MVP; add Redis only with measured need.
Consequences: compose has no redis service (documented; easy to add).

### D-010 Hand-written frontend DTO types (no OpenAPI codegen) — 2026-11-04
Context: Codegen adds build coupling early.
Decision: Hand-mirror server DTOs in `frontend/src/types/`; revisit codegen in Phase 9 if drift observed.

## D-011 No URI versioning in MVP — 2026-11-04 (supersedes the Phase 1 deferral note)
Context: Single SPA client + single API deployable; no concurrent API versions needed.
Decision: Ship unversioned routes under `/api`. Revisit versioning when a breaking change must coexist with an old client.

## D-012 Custom JWT guard instead of Passport — 2026-11-04
Context: Standard NestJS JWT auth pulls passport + strategies for a simple Bearer flow.
Decision: Hand-rolled `JwtAuthGuard` (Bearer verify + single membership query) registered as global `APP_GUARD`; `RolesGuard` reads `@Roles()`. No passport dependency.
Consequences: Less magic, strict types, testable without passport harnesses. Revisit if OAuth/SSO strategies land.

## D-013 Public self-service registration — 2026-11-04
Context: No external IdP; orgs must bootstrap themselves.
Decision: `POST /auth/register` creates an isolated org with the caller as org-admin. Rate-limited (10/min). Revisit (invite-only + `ALLOW_PUBLIC_REGISTER` flag) if abuse appears.
