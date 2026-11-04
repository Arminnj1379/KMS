# Implementation Plan — Phased Roadmap

> Each phase ends with the Strict Completion Gate (§4 of task brief). Status tracked in PROGRESS.md.

## Phase 0 — Inspection & Design ✅ (this batch)
- [x] Inspect repo (empty — no legacy to preserve; no AGENTS.md/README found).
- [x] Write PRODUCT_REQUIREMENTS, ARCHITECTURE, DATABASE_DESIGN, IMPLEMENTATION_PLAN, DECISIONS, PROGRESS, AGENTS.md.
- [x] Fix folder structure + Prisma schema draft.
- Gate: docs internally consistent, module DAG acyclic, ER implementable in Prisma.

## Phase 1 — Foundation (in progress)
1. `docker-compose.yml` (db, api, web, minio, minio-init), root `.env.example`, `.gitignore`, `README.md`.
2. Backend: NestJS minimal (no `nest new` network dependency — hand-written `package.json` + `src/`), strict TS, eslint+prettier, zod env, pino logging, exception filter, validation pipe, Swagger, `/health` `/ready`, PrismaService, Prisma schema + initial migration SQL + seed.
3. Frontend: Vite React TS strict, Tailwind, Router, Query, RHF+Zod skeleton, i18n fa skeleton, AppShell + Login/Dashboard placeholders, health check hook.
4. Verify: `tsc --noEmit` both, `npm run build` both, `docker compose config`, backend unit smoke (health, exception filter), Prisma validate.
5. Docs update + PROGRESS.

## Phase 2 — Identity & Access Management
- identity module (register/bootstrap, login, refresh rotation, logout, me, change-password), bcryptjs, sessions table, JwtStrategy, Roles + resource guards, users module, organizations+departments+memberships, frontend auth flow + RequireAuth + profile page, tests (auth happy path, wrong password, refresh rotation/reuse, cross-org 403).

## Phase 3 — KB Foundation
- knowledge-bases + kb_members + categories (path/depth maintenance, move cycle-check), org isolation tests, frontend KB list/detail + category tree UI.

## Phase 4 — Articles
- articles CRUD, Tiptap editor (JSON + autosave + 409 conflict dialog), preview, tags, related, frontend editor page + view page, tests (create/edit/publish-draft scoping, slug uniqueness per KB).

## Phase 5 — Documents & Versioning
- MinIO StorageService, upload-intent/confirm, attachments, article-versions snapshot/restore/diff, frontend attachments + history UI, tests (immutable history, restore-creates-new-version).

## Phase 6 — Approval Workflow
- review_requests + state machine + history, notifications hook, frontend review inbox + approve/reject dialogs, tests (illegal transition 422, reviewer-only approve).

## Phase 7 — Search
- MongoSearchService (text index + regex fallback), SearchController with permission scoping, frontend search page + filters, tests (org isolation in results, relevance ordering smoke).

## Phase 8 — Notifications & Audit
- notifications CRUD + emitter, audit-log writer + admin query UI, bell + activity pages, async-ready interface (no broker yet).

## Phase 9 — Polish & Prod-readiness
- Responsive/a11y pass, empty/loading/error states, indexes review (`EXPLAIN`), rate limits, security headers audit, `DEPLOYMENT.md`, full suite green, demo seed polish.

## Estimates & Ordering Notes
- Strictly sequential 1→9 (each builds on prior module contracts). No parallel module work to avoid contract drift.
- Definition of done per phase = gate checklist in PROGRESS.md (builds + tsc + tests + docs).
