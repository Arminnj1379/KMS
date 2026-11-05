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

## D-014 MongoDB replaces PostgreSQL as the primary database — 2026-11-04
Context: Product decision to move off PostgreSQL/Prisma; content is document-shaped (Tiptap JSON, versions, audit metadata).
Decision: MongoDB 8 + Mongoose (`@nestjs/mongoose`) is the only application database. No polyglot persistence; Prisma/Postgres removed from app code, compose, env, and scripts.
Consequences: FK enforcement moves to services + tests; `citext` replaced by lowercase-on-write; FTS replaced by a Mongo text index behind the same swappable `SearchService` seam; single-node replica set `rs0` is mandatory (transactions).

## D-015 Single-node replica set for transactions — 2026-11-04
Context: Multi-document atomicity (register, refresh rotation, dept move, KB cascade) requires transactions, which need a replica set.
Decision: Compose runs `mongo --replSet rs0` + one-shot `mongo-init` (`rs.initiate`, idempotent). App uses `session.withTransaction()` only where genuinely multi-document; standalone Mongo is unsupported.
Consequences: `mongo-init` must succeed before transactional smoke tests; integration test asserts a commit through the configured URI.

## D-016 Global Mongoose models replace global PrismaService — 2026-11-04
Context: `PrismaService` was `@Global()`; services and guards depended on it. Mongoose models must be injectable with the same ergonomics without leaking documents across the codebase.
Decision: `common/mongo/MongoModule` (`@Global()`) owns the connection + registers all schemas; services inject `Model<T>` and always `.lean()` + map to plain DTO shapes. No generic repositories/base CRUD classes; no Mongoose documents cross service boundaries.
Consequences: Module dependency direction unchanged (users/organizations → permissions; identity standalone); `common/` still never imports from `modules/`.

## D-017 Join collections eliminated via arrays — 2026-11-04
Context: PG `article_tags` / `article_attachments` joins have no document equivalent.
Decision: `articles.tagIds: ObjectId[]` (tags stay org-owned) and `articles.attachments[]` (embedded `{documentId, createdBy, createdAt}` links; `documents` retain their own lifecycle). KB delete cascades in a transaction.
Consequences: Tag rename stays single-doc; attachment links are bounded per article (no 16MB risk).

## D-018 Email/slug normalization replaces citext — 2026-11-04
Context: PG used `citext` for `users.email` / `tags.name`.
Decision: Lowercase + trim on write and on lookup (`normalizeEmail`, slug DTOs lowercased); unique indexes on the normalized value.
Consequences: Case-variant duplicates impossible; display values keep original casing where needed (fullName, tag name).

## D-019 Explicit versions only: changelog-gated snapshots — 2026-11-04
Context: Autosave fires every few seconds; snapshotting every write would flood `articleVersions` and make history useless.
Decision: `PATCH articles` stores an immutable snapshot only when the client sends `changelog` (explicit "save version" via the editor's version-note field or the history card's snapshot button). Every status transition (publish/unpublish/archive/restore) always snapshots with a server-generated changelog. Manual `POST versions` snapshots the current state on demand. Restore never rewrites history — it copies a snapshot into a NEW article version (which itself snapshots when a changelog is present).
Consequences: History stays meaningful; autosaves only bump the monotonic counter. Tests assert snapshot-on-changelog, no-snapshot-on-autosave, snapshot-on-transition, restore-creates-new-version.

## D-021 Review assignment + decision rights — 2026-11-04
Context: Contributors must get reviews without handing every draft to managers; managers keep override.
Decision: Submitter (manager/contributor) assigns a reviewer who must be an org member AND (KB member with `reviewer`/`manager` role OR org-admin). Self-review → 422. One pending request per article → 409. Decide (approve/reject) requires the assigned reviewer or manager/org-admin (403 otherwise); cancel requires the requester or manager (403 otherwise). Stale decisions (non-pending request, or article left `in_review` via a direct manager transition) → 422.
Consequences: Reviewer role finally used; managers can always unblock. Direct manager transitions (publish/archive/…) bypass review rows — documented debt, not silent: deciding on them 422s and the requester/manager cancels.

## D-022 Notifications as an injected seam (Phase 8 preview) — 2026-11-04
Context: ARCHITECTURE D-005 promises an async seam (`NotificationsPort`); Phase 8 builds persistence + inbox.
Decision: `common/notifications` exports `NOTIFICATIONS_PORT` + abstract `NotificationsPort.notify()`; Phase 6 ships a logging default and calls it best-effort post-commit on submit/approve/reject/cancel (failures logged, never fail the request). Persistence + Bell UI land in Phase 8 behind the same token.
Consequences: Unit tests assert hook payloads; swapping in a DB/BullMQ implementation touches no review logic.

## D-023 Cross-KB search scoping + $text/regex fallback — 2026-11-05
Context: Search must span KBs but never leak private-KB content; Persian has no Mongo stemmer.
Decision: `GET /search` is permission-scoped by `KnowledgeBasesService.accessibleKbIds` (org-admin → all org KBs; members → own memberships ∪ internal/public KBs, with membership candidates re-constrained to the org since memberships carry no orgId); a `kbId` filter re-validates via `requireAccess` (foreign KB → 404, no existence leak). Engine (`ArticlesService.globalSearch`, called through the thin `SearchService` façade): `$text` first (index `article_text`, `language_override: none`), relevance-ordered by `$meta: textScore`; regex fallback (escaped, case-insensitive over title/summary/contentText) only when `$text` yields zero rows or throws (query quote-sanitized + try/catch). Hits embed `kbTitle`/`kbSlug` (via `titlesByIds`) + a `snippetFor` window (summary preferred). DTO enforces `q ≥ 2` chars (a single-char regex would scan everything); the frontend additionally gates <2 chars client-side with debounce.
Consequences: No ES dependency in MVP; swapping in Atlas/ES later touches only `SearchService` behind the same controller (ARCHITECTURE §9). Known limit: exact-token matching for Persian affixes (راهنما ≠ راهنمای); an n-gram index or query normalization is deferred to Phase 9.

## D-020 Local storage driver for offline/registry-blocked environments — 2026-11-04
Context: `StorageService` targets S3/MinIO, but the sandbox registry denies `minio/*` pulls, so the `s3` driver cannot be verified live here.
Decision: Add a `local` filesystem driver behind the same seam (`STORAGE_DRIVER=s3|local`, default `s3`). Local mode stores bytes under `UPLOADS_DIR/<orgId>/` with a mime sidecar; the client PUTs bytes to `PUT documents/upload/:key` and downloads stream through `GET documents/:id/file` (auth-guarded, no CORS/presign needed). S3 mode keeps presigned PUT/GET with the server never proxying bytes. Compose/prod stay on `s3`; local is for dev verification and offline laptops (single replica only).
Consequences: Phase 5 verified live with `STORAGE_DRIVER=local`; MinIO path is code-reviewed + unit-covered but needs a networked environment for live confirmation (recorded as debt).
