# Product Requirements — Enterprise Knowledge Management System (KMS)

> Status: Phase 0 baseline. Persian-first (fa-IR, RTL). Extensible to en-US/LTR.
> Owner: Principal Architect. Date: 2026-11-04.

## 1. Vision

A production-oriented, secure, maintainable Enterprise Knowledge Management System for
organizations to create, structure, approve, publish, search, and audit institutional knowledge.
Quality bar: Linear / Notion / Confluence level UX, not a demo.

## 2. Users & Actors

| Actor | Description |
|---|---|
| Super Admin | Platform-level administration (bootstrap only, minimal surface). |
| Org Admin | Manages organization, departments, members, roles, knowledge bases, settings. |
| KB Manager / Owner | Owns a knowledge base; manages categories, contributors, publishing policy. |
| Contributor / Author | Creates and edits drafts, uploads attachments, requests review. |
| Reviewer | Reviews submissions, approves/rejects with comments. |
| Reader | Searches, reads published content within granted scope. |
| System | Audit logger, notification emitter, version tracker. |

## 3. Core Use Cases (MVP scope)

### UC-1 Identity & Access
- Register (bootstrap) / login / logout / refresh / change password.
- Profile management (name, avatar, locale).
- Org Admin invites/manages users; departments group users.
- RBAC: `org-admin`, `kb-manager`, `contributor`, `reviewer`, `reader`.
- Resource-level checks: KB membership, article ownership, review assignment.
- Backend enforces all authorization; frontend only hides UI.

### UC-2 Organizations & Departments
- One user belongs to one active organization (multi-org membership supported in schema via `memberships`, MVP enforces single-org-per-session via `orgId` claim).
- Departments: tree (one level MVP, adjacency list ready for depth).
- Org isolation: every business query scoped by `organizationId`.

### UC-3 Knowledge Bases
- CRUD knowledge base (title, slug per org, description, icon, visibility: `private|internal|public`).
- Owner + contributors (KB membership table with role).
- Only members can see `private`; org members see `internal`.

### UC-4 Categories
- Hierarchical categories per KB (adjacency list + `path` materialized for ordering).
- CRUD + move (cycle-safe) + ordering.
- Articles belong to at most one category (nullable = uncategorized).

### UC-5 Articles (core value)
- Create draft (title, slug per KB, summary, content JSON via Tiptap, category, tags).
- Edit with autosave (client debounce 2s) + optimistic concurrency via `updatedAt`/`version` check → 409 on conflict.
- States: `draft → in_review → published`, plus `archived`. Rejection returns to `draft`.
- Preview (rendered read view), related articles (same tags/category).
- Ownership: author; KB contributors can co-edit drafts per permission.
- Content stored as Tiptap JSON (`contentJson`) + derived `contentText` (plain text for search) + `contentHtml` (server-sanitized render cache). Never store HTML as source of truth.

### UC-6 Documents & Versioning
- S3-compatible (MinIO) object storage, presigned upload/download.
- Validation: allowlist MIME + size cap (default 25MB), virus-scan hook point (not implemented).
- Attachments linked to articles (`article_attachments`).
- Every publish and every explicit "save version" creates immutable `article_versions` snapshot (title, contentJson, version number, author, changelog). Restore = create new version copying old content (history preserved, never overwrite).

### UC-7 Approval Workflow
- `review_requests`: article → reviewer(s), comment, due date.
- Transitions guarded by state machine; only valid transitions allowed (see ARCHITECTURE §7).
- Reviewer comments, decision history (`workflow_history`).
- Notifications on request / approve / reject.

### UC-8 Search & Discovery
- Phase 7: PostgreSQL FTS (`tsvector` on title/summary/contentText) + trigram fallback (pg_trgm).
- Filters: query, tags, category (incl. subtree), KB, author, status (permission-filtered), pagination, sort (relevance/newest/updated/title).
- Module boundary: `SearchModule` exposes `SearchService.search(dto)`; FTS implementation swappable for Elasticsearch later.

### UC-9 Notifications & Audit
- In-app notifications (review assigned, approved, rejected, mentioned, article updated).
- `audit_logs`: who did what to which resource, when, from which IP, with diff metadata. Append-only.
- Async: synchronous in-process for MVP; outbox-ready interface so RabbitMQ/BullMQ can be added with justification only.

## 4. Non-Functional Requirements

- Security: bcrypt (cost 12), JWT access (15m) + refresh (7d, rotation, reuse detection), helmet, CORS allowlist, rate limiting (auth endpoints), Zod/class-validator input validation, sanitized HTML, presigned URLs (no public bucket), secrets via env.
- Data integrity: FKs, unique constraints (`org slug`, `kb slug per org`, `article slug per kb`, `category slug per kb`), transactions for multi-write ops, Prisma migrations only.
- Observability: centralized structured logging (pino), correlation/request IDs, health checks (`/health`, `/ready`), Swagger/OpenAPI.
- UX: Persian RTL default, Vazirmatn font, light/dark themes, responsive (≥360px), accessible (focus states, aria, keyboard nav for dialogs/menus), loading/empty/error states everywhere, no dead buttons.
- Performance: pagination everywhere, DB indexes on FK + search vectors, N+1 avoidance (Prisma `include` batching), frontend code-splitting + React Query caching.
- Testing: critical-path tests (auth, authz, org isolation, article lifecycle, workflow transitions, version restore, search scoping).

## 5. Out of Scope (MVP)

- Elasticsearch cluster, RabbitMQ, real-time collaboration (OT/CRDT), public anonymous portal,SSO/LDAP, AI embeddings, mobile apps, billing.
- Each has an explicit extension point documented in ARCHITECTURE.md.

## 6. Acceptance Criteria (product-level)

1. Org Admin can onboard org → departments → users → KB → categories → articles → review → publish → search → audit, end-to-end, RTL Persian.
2. Unauthorized cross-org access returns 403/404 without data leakage (tested).
3. Version history is immutable and restorable.
4. Invalid state transitions are rejected (tested).
5. `docker compose up` brings up db + api + web + minio; health checks pass.
6. `npm run build` passes for backend and frontend; `tsc --noEmit` clean; critical tests green.
