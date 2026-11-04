# Database Design — KMS (MongoDB 8 + Mongoose)

> Authoritative: this file + `backend/src/common/mongo/schemas/*`.
> Status: migrated from PostgreSQL/Prisma (see Appendix A for the PG→Mongo mapping and Step-A plan).
> Conventions: camelCase fields; `_id: ObjectId` (API exposes `id: string`); `createdAt/updatedAt` via Mongoose `timestamps: true` on all collections; soft-delete only for `articles` (`deletedAt`); everything else hard-delete with app-level guards where history matters. Timestamps are JS `Date` (BSON datetime).

## 1. Why MongoDB (D-014)

- Content is document-shaped (Tiptap JSON, version snapshots, notification payloads, audit metadata) — embedding and schema flexibility beat joins.
- One primary database is kept (no polyglot ops): MongoDB is the **only** application database.
- Trade-offs accepted: no FK enforcement (app-level checks + tests), no `citext` (lowercase-on-write + unique indexes), no trigram (text index + regex fallback), multi-document writes need a replica set (single-node `rs0` in compose).

## 2. Collections overview

```
organizations 1──* departments (self-ref via parentId)
organizations 1──* memberships *──1 users
users 1──* sessions (refresh families)
organizations 1──* knowledgeBases 1──* categories (self-ref)
knowledgeBases 1──* kbMembers *──1 users
knowledgeBases 1──* articles 1──* articleVersions
articles ──* tags (via articles.tagIds[], no join collection)
articles ──* documents (via articles.attachments[].documentId, documents retained after unlink)
articles 1──* reviewRequests 1──* workflowHistory (per-article, separate)
articles 1──* comments (flat + one-level parentId)
users 1──* notifications
auditLogs polymorphic (organizationId?, actorId?, resourceType + resourceId string, no FK)
```

17 collections: `users, organizations, memberships, departments, sessions, knowledgeBases, kbMembers, categories, articles, articleVersions, tags, documents, reviewRequests, workflowHistory, comments, notifications, auditLogs`.
Eliminated joins (vs PG): `article_tags` → `articles.tagIds: ObjectId[]`; `article_attachments` → `articles.attachments[]` (embedded link rows).

## 3. Embedding vs referencing (D-017)

| Relationship | Choice | Reason |
|---|---|---|
| org → departments | separate `departments` | unbounded per org, subtree queries, independent pagination |
| user ↔ org (membership) | separate `memberships` | many-to-many, queried both directions, role filtering, pagination |
| user → sessions | separate `sessions` | high churn, TTL-ish lifecycle, family queries; embedding would bloat user docs |
| KB → members | separate `kbMembers` | same as memberships (role-filtered roster) |
| KB → categories | separate `categories` | tree ops (move/cycle checks), position ordering, subtree queries |
| KB → articles | separate `articles` (+ denormalized `organizationId` for scoping) | unbounded, independently paged/searched; org denormalized so every business query filters `organizationId` without a KB lookup |
| article → versions | separate `articleVersions` (immutable) | unbounded growth; embedding would breach the 16MB document limit; insert-only enforced in service + test |
| article ↔ tags | `articles.tagIds[]` + separate `tags` | tags owned by org (shared across KBs); array of refs avoids a join collection; tag rename stays single-doc |
| article ↔ documents | separate `documents` + embedded `articles.attachments[{documentId,createdBy,createdAt}]` | documents have own lifecycle (retained for audit after unlink); per-article links are few (bounded) so embedding is safe |
| article → reviewRequests / workflowHistory | separate collections | append-mostly, queried by article+status/time; embedding history in article would grow it forever |
| article → comments | separate `comments` | unbounded, paged, one-level threads |
| user → notifications | separate `notifications` | high volume, read-state updates, per-user paging |
| * → auditLogs | separate `auditLogs`, no refs | polymorphic by design; `resourceId` stored as string (ObjectId hex where applicable) |

Rule of thumb applied: embed only small, bounded, exclusively-owned sub-objects (attachment links); reference everything else. No deeply nested documents anywhere.

## 4. Schemas (authoritative summary)

### users
`email` (lowercased, unique), `passwordHash`, `fullName`, `avatarUrl?`, `locale='fa'`, `isActive=true`, `isSuperAdmin=false`, `lastLoginAt?` + timestamps.
Indexes: `{ email: 1 }` unique.

### organizations
`name`, `slug` (unique), `description?`, `logoUrl?` + timestamps.
Indexes: `{ slug: 1 }` unique.

### memberships
`organizationId` ref→organizations (cascade delete in service), `userId` ref→users, `role` (`org-admin|member`), `departmentId?` ref→departments (null on department delete, app-enforced) + `createdAt/updatedAt`.
Indexes: `{ organizationId: 1, userId: 1 }` unique; `{ userId: 1 }`; `{ organizationId: 1, role: 1 }`.

### departments
`organizationId` ref, `parentId?` self-ref, `name`, `slug`, `description?`, `path` (materialized `/root/child`), `depth` + timestamps.
Indexes: `{ organizationId: 1, slug: 1 }` unique; `{ organizationId: 1, parentId: 1 }`; `{ organizationId: 1, path: 1 }` (subtree prefix moves).

### sessions (refresh families)
`userId` ref→users, `refreshHash` (sha256 hex, unique), `familyId` (random hex string), `expiresAt`, `revokedAt?`, `ip?`, `userAgent?`, `createdAt`.
Indexes: `{ refreshHash: 1 }` unique; `{ familyId: 1 }`; `{ userId: 1 }`; `{ expiresAt: 1 }` (expiry scans).

### knowledgeBases
`organizationId` ref, `title`, `slug`, `description?`, `icon?`, `visibility` (`private|internal|public`, default `internal`), `ownerId` ref→users (restrict: owner reassignment required before user cleanup — app rule) + timestamps.
Indexes: `{ organizationId: 1, slug: 1 }` unique; `{ organizationId: 1, visibility: 1 }`.

### kbMembers
`knowledgeBaseId` ref, `userId` ref, `role` (`manager|contributor|reviewer|reader`), `createdAt`.
Indexes: `{ knowledgeBaseId: 1, userId: 1 }` unique.

### categories
`knowledgeBaseId` ref, `parentId?` self-ref, `title`, `slug`, `description?`, `position=0`, `path`, `depth=0` + timestamps.
Indexes: `{ knowledgeBaseId: 1, slug: 1 }` unique; `{ knowledgeBaseId: 1, parentId: 1, position: 1 }`; `{ knowledgeBaseId: 1, path: 1 }`.

### articles
`organizationId` ref (denormalized scope — must equal the KB's org, enforced in service on create/move), `knowledgeBaseId` ref, `categoryId?` ref (null on category delete), `authorId` ref→users (restrict), `title`, `slug`, `summary?`, `contentJson` (Mixed, Tiptap doc), `contentText` (plain, search), `contentHtml?` (sanitized cache), `status` (`draft|in_review|published|archived`, default `draft`), `version=1`, `viewCount=0`, `tagIds: ObjectId[]` ref→tags, `attachments[{documentId,createdBy,createdAt}]`, `publishedAt?`, `deletedAt?` + timestamps.
Indexes: `{ knowledgeBaseId: 1, slug: 1 }` unique; `{ knowledgeBaseId: 1, status: 1, publishedAt: -1 }`; `{ authorId: 1 }`; `{ organizationId: 1, status: 1, publishedAt: -1 }`; text `{ title: 'text', summary: 'text', contentText: 'text' }` (language `none` — Persian has no Mongo stemmer; relevance is keyword-based, swappable later per ARCHITECTURE §9).

### articleVersions (immutable)
`articleId` ref, `version`, `title`, `summary?`, `contentJson` (Mixed), `contentText?`, `changelog?`, `createdBy` ref→users, `createdAt` (no `updatedAt` — never updated).
Indexes: `{ articleId: 1, version: 1 }` unique; `{ articleId: 1, createdAt: 1 }`.

### tags
`organizationId` ref, `name`, `slug` (lowercased on write) + `createdAt`.
Indexes: `{ organizationId: 1, slug: 1 }` unique.

### documents
`organizationId` ref, `uploaderId` ref→users (restrict), `objectKey` (unique), `filename`, `mime`, `sizeBytes`, `checksumSha256?`, `createdAt`.
Indexes: `{ objectKey: 1 }` unique; `{ organizationId: 1, createdAt: -1 }`.

### reviewRequests
`organizationId` ref (org scope), `knowledgeBaseId` ref, `articleId` ref, denormalized display snapshot (`articleTitle`, `articleSlug`, `kbTitle`, `kbSlug` — captured at submit so the cross-KB inbox is one org-scoped query, same embed pattern as notifications), `requesterId` ref, `reviewerId` ref, `status` (`pending|approved|rejected|cancelled`), `comment?`, `decidedAt?` + timestamps.
Indexes: `{ articleId: 1, status: 1 }`; `{ reviewerId: 1, status: 1 }`; `{ organizationId: 1, reviewerId: 1, status: 1, createdAt: -1 }`; `{ organizationId: 1, requesterId: 1, status: 1, createdAt: -1 }`.

### workflowHistory (append-only)
`articleId` ref, `fromStatus`, `toStatus`, `actorId` ref, `comment?`, `createdAt`.
Indexes: `{ articleId: 1, createdAt: 1 }`.

### comments
`articleId` ref, `authorId` ref (restrict), `parentId?` self-ref (replies removed with parent — app cascade), `body` + timestamps.
Indexes: `{ articleId: 1, createdAt: 1 }`.

### notifications
`userId` ref, `type`, `title`, `body?`, `data?` (Mixed), `isRead=false`, `createdAt` (no `updatedAt` — read-state flips use `isRead` + a `readAt?` field if needed; MVP keeps `isRead` only).
Indexes: `{ userId: 1, isRead: 1, createdAt: -1 }`.

### auditLogs (append-only)
`organizationId?` (string ObjectId hex, no ref), `actorId?`, `action` (e.g. `article.publish`), `resourceType`, `resourceId` (string), `metadata?` (Mixed), `ip?`, `createdAt`.
Indexes: `{ organizationId: 1, createdAt: -1 }`; `{ resourceType: 1, resourceId: 1 }`.

## 5. Integrity rules (app-enforced; no FKs in Mongo)

- `articles.organizationId` must equal its KB's `organizationId` — checked in service on create/move (same tech-debt note as PG era, covered by tests).
- Deleting a KB requires explicit `?confirm=true` and removes categories/articles/versions/links in one transaction; `documents` rows are retained (orphan cleanup out of scope).
- `articleVersions` insert-only: service never updates/deletes; test asserts row-count monotonicity.
- Refresh `familyId` reuse (already-rotated hash presented) → whole family revoked.
- Duplicate-key races (E11000) map to 409; null lookups map to 404 (never leak driver errors).
- Invalid ObjectId strings from clients map to 404 (never 500 CastError).

## 6. Index strategy (query-driven)

- Auth: `users.email` unique; `sessions.refreshHash` unique + `familyId`; `memberships(userId)`.
- Lists: `articles(kb,status,publishedAt)`, `articles(org,status,publishedAt)`, `categories(kb,parent,position)`, `notifications(user,read,created)`.
- Search: text index `articles(title,summary,contentText)` + `articleTags` covered by multikey index on `tagIds` (add `{ tagIds: 1 }` when article module lands).
- Audit: `auditLogs(org,created)` + `(resourceType,resourceId)`.
- No speculative indexes: each index above traces to a service query in §4 consumers.

## 7. Transactions (D-015)

- Single-node replica set `rs0` in compose (dev) and required wherever multi-document atomicity is needed; standalone Mongo is **not** supported for this app.
- All multi-write flows use `session.withTransaction()`: register (user+org+membership+session), login (session+lastLoginAt), refresh rotation (revoke old + insert new), change-password (hash update + revoke all), department subtree move, KB delete cascade (Phase 3+).
- Read-your-own-write and single-document updates never use transactions.

## 8. Migrations & seed

- No ORM migrations: schemas are code (`SchemaFactory`); indexes are declared in schema files and built by Mongoose on startup (`autoIndex: true` in dev/test; in production set `autoIndex: false` and run `npm run db:indexes` — Phase 9).
- Seed (`backend/scripts/seed-mongo.ts`, idempotent upserts): demo org + admin (`admin@kms.local` / `ChangeMe123!`), one KB + admin `manager` membership. Credentials must change after first login.

## Appendix A — PG→Mongo migration record (Step-A plan, executed)

**Pre-migration PG state (inspected 2026-11-04):** 19 models in `prisma/schema.prisma`, 3 migration dirs; live compose PG held dev/test data only (2 orgs, 3 users, 3 memberships, 2 departments, 7 sessions, 1 KB) — no production data. Backup taken (`backups/pg-pre-mongo-*.dump`) before PG removal; restore procedure in `backups/README.md`. No data migration was needed beyond re-seeding Mongo.
**Prisma touchpoints removed:** `@prisma/client` + `prisma` CLI, `backend/prisma/*`, `PrismaService/PrismaModule`, `DATABASE_URL`, all `prisma.*` query call-sites (identity, users, organizations, permissions, health, guards), Prisma error-code branches (P2002→E11000, P2025→null-check), specs mocking `PrismaService`.
**Code changes:** `common/prisma/*` → `common/mongo/*` (global `MongoModule`, 17 schemas, `withTransaction` helper, error/object-id utils); services reimplemented on injected `Model<T>` with identical API contracts, business rules, and Persian error strings; `JwtAuthGuard` re-reads membership via Mongoose; `env.ts` requires `MONGODB_URI`; Dockerfile drops generate/migrate steps; compose swaps `db`→`mongo(+mongo-init rs0)`.
**Risks & mitigations:** (1) lost FK cascades → service-level deletes + tests; (2) case-insensitive uniqueness → lowercase-on-write; (3) transaction support → mandatory rs0, integration test asserts `withTransaction` commits; (4) FTS regression → text index now, swappable search façade unchanged; (5) CastError 500s → ObjectId validation → 404.
