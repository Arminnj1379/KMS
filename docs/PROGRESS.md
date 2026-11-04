# Progress Tracker

> Updated after every phase (see task §10). Legend: ✅ done · 🟡 partial · ⬜ not started · 🛑 blocked.

## Current: Phase 4 ✅ complete — next: Phase 5 Documents & Versioning

| Phase | Status | Notes |
|---|---|---|
| Phase 0 Inspection & Design | ✅ | Empty repo confirmed; 7 docs; module DAG + ER + FTS + state machine. |
| Phase 1 Foundation | ✅ | Verified green (builds, tsc, 3 tests, runtime health/ready/docs, compose db). MinIO pull blocked in sandbox (documented). |
| 2 Identity & Access | ✅ | Backend: identity/users/orgs/permissions modules, global JWT+roles+throttle guards. Frontend: login/register/profile/admin, RequireAuth, 401 interceptor. |
| PG → Mongo migration | ✅ | Mongoose 8 + MongoDB 8 (rs0) is the only app DB. Prisma/Postgres removed; 24/24 smoke + 28/28 tests green on Mongo. |
| 3 KB Foundation | ✅ | Backend: KB CRUD + members + nested categories (cycle-safe, org-isolated). Frontend: KB list/detail + category tree + member management. |
| 4 Articles | ✅ | Backend: articles CRUD + optimistic 409 + tags + related + publish/archive state machine (org-isolated). Frontend: Tiptap editor + autosave + conflict dialog, list/view pages. |
| 5 Documents & Versioning | ⬜ | — |
| 6 Approval Workflow | ⬜ | — |
| 7 Search | ⬜ | — |
| 8 Notifications & Audit | ⬜ | — |
| 9 Polish & Prod-readiness | ⬜ | — |

## Phase 0 — completed work
- Inspected `E:\Najafi\KMS` (empty, not a git repo, no AGENTS.md/README).
- Wrote `docs/{PRODUCT_REQUIREMENTS,ARCHITECTURE,DATABASE_DESIGN,IMPLEMENTATION_PLAN,DECISIONS}.md`, `AGENTS.md`.
- Defined module DAG, ER model, FTS strategy, state machine, storage flow.
- Tests: n/a (design phase). Builds: n/a.

## Phase 1 — completed 2026-11-04 ✅
- [x] Docs + roadmap.
- [x] Root: workspaces, compose (db/api/web/minio), .env.example, .gitignore, README.
- [x] Backend: modular skeleton, strict TS, zod env (+dotenv fallback), pino, exception filter, validation pipe, Swagger, /health + /ready, Prisma schema (16 tables) + migrations + seed.
- [x] Frontend: Vite+Tailwind RTL, Router, Query, i18n fa/en, AppShell, Dashboard w/ live health, Login/Search placeholders, 404.
- [x] Verified green: prisma validate+migrate+seed ok; tsc clean (api+web); builds pass; backend tests 3/3; runtime /api/health + /api/ready + /api/docs = 200; compose config valid, db healthy.
- Known limits: minio/mc images unpullable in this sandbox (registry deny) → minio services untested here, exercised in Phase 5 where reachable; no host psql (used Prisma + container pg).
- Fixed en route: pino-http 10→9, tsconfig composite/paths, spec import, URI-versioning deferred (D-011), dotenv cwd fallback.
## Phase 2 — completed 2026-11-04 ✅
- Backend: `identity` (register/login/refresh rotation+reuse→family revoke/logout/me/change-pw, bcrypt 12, sha256-hashed opaque refresh in `sessions`), `users` (org-scoped list/invite/update, self-deactivate + last-admin guards), `organizations` (profile, department tree + cycle-safe move + non-empty delete guard, member roster incl. existing-user attach), `permissions` (`requireMember` 404 / `requireAdmin` 403 choke point).
- Security: global `JwtAuthGuard` (Bearer verify + fresh membership lookup per request) + `RolesGuard` + `ThrottlerGuard` (auth endpoints 10/min); cross-org ids resolve to 404 (no existence leak); passwords never leave the server.
- Schema delta (migration `20261104200000_phase2_auth`): `sessions.refresh_hash` UNIQUE, `departments.description`.
- Frontend: RHF+Zod login/register, `RequireAuth`, profile + change-password (clears tokens), admin users table + invite + activate/deactivate, 401 interceptor, fa/en strings.
- Verification (all green, executed 2026-11-04):
  - unit: 24/24 pass (identity flows incl. rotation/reuse, guards, permissions, last-admin + cycle rules).
  - `tsc --noEmit` clean (api+web); `eslint` backend clean; `nest build` + `vite build` pass.
  - live smoke vs compose Postgres (24 checks): register/409-dup/login/me/wrong-pw-401/no-token-401/cross-org-404/invite/member-403/roster-200/rotation/reuse-401/family-dead-401/change-pw + old-401/new-200/last-admin-422/dept CRUD + cycle-422 + nonempty-422/logout + refresh-401. One harness-side 401 (missing header) re-run correctly → 422.
- Debt: no auto refresh-token rotation on the client (401 → re-login; acceptable with 15m access); multi-org session switching unresolved (first membership wins); promotion to org-admin unguarded by design.
- Test data left in dev DB only: demo org + `p2a/p2b` orgs. Next: Phase 3 KB Foundation.

## Migration PostgreSQL → MongoDB — completed 2026-11-04 ✅
- Pre-migration: inspected live PG (dev/test data only: 2 orgs, 3 users, 3 memberships, 2 departments, 7 sessions, 1 KB); backup `backups/pg-pre-mongo.dump` (`pg_dump -Fc`); restore notes in `backups/README.md`. No production data → re-seed strategy, no row migration.
- Step A (plan): `docs/DATABASE_DESIGN.md` rewritten (17 collections, embedding-vs-reference table, index/tx strategy, Appendix A record); D-014..D-018 in DECISIONS.md.
- Step B (infra): compose `mongo:8.0 --replSet rs0` + one-shot `mongo-init` (`rs.initiate`, verified PRIMARY); `MONGODB_URI` in env/compose; legacy `db` service + `pgdata` removed after verification; backup retained.
- Step C (persistence): global `MongoModule` replaces `PrismaModule` (D-016); 17 schemas in `common/mongo/schemas`; `withTransaction` helper (D-015); `mongo-errors` (E11000→409) + `object-id` (invalid→404, lowercase emails/slugs) utils; services + guards reimplemented on `Model<T>` with identical API contracts and Persian error strings; `env.ts` requires `MONGODB_URI`; Dockerfile drops generate/migrate steps.
- Step D (data): seed rewritten (`scripts/seed-mongo.ts`, idempotent upserts: demo org + `admin@kms.local` + general KB).
- Step E (removal): `@prisma/client` + `prisma` CLI gone from deps; `backend/prisma/*` + `common/prisma/*` deleted; `DATABASE_URL`/`POSTGRES_*` removed from code/env/compose; repo-wide grep clean except history docs (kept intentionally), code comments, and the compose restore note.
- Verification (all executed 2026-11-04): `tsc` clean (api+web); backend `eslint` clean; `nest build` + `vite build` pass; unit **28/28** (incl. 3 live integration tests: unique email E11000, compound membership unique, `withTransaction` commit on rs0); live smoke **24/24 PASS** on Mongo (register/dup/login/me/wrong-pw/no-token/cross-org/invite/member-403/roster/rotation/reuse/family-dead/change-pw/old/new/last-admin/dept CRUD+cycle+nonempty/logout); `/api/health` + `/api/ready` (mongo ping) 200; `docker compose config` valid.
- Debt: `autoIndex: false` in production + explicit index step deferred to Phase 9; text index is keyword-based (Persian has no stemmer) — swappable search façade unchanged; integration spec skips cleanly when MongoDB is unreachable.

## Phase 3 — completed 2026-11-04 ✅
- Backend `knowledge-bases` module: KB CRUD (slug unique per org, visibility private/internal/public), KB members (manager/contributor/reviewer/reader; member must belong to org; dup → 409), nested `categories` (tree + path/depth, cycle-safe move, non-empty delete guard). Org-scoped; missing/forbidden KB → 404 (no leak); management requires manager/org-admin (403); delete requires `?confirm=true` and cascades members + categories in one transaction (articles cascade lands in Phase 4).
- Org-admin bypasses all KB checks (fallback control, so no last-manager guard by design); KB owner is created as manager at creation.
- Frontend: `/kbs` list + create dialog, `/kbs/:id` detail (edit, two-step delete, member roster + role change + invite/remove, category tree with add-child/rename/reparent/delete), nav link, fa/en strings.
- Verification (all green, executed 2026-11-04):
  - unit: **36/36** (incl. 8 new KB/category rule tests: private invisibility, reader/manager authorization, confirm + cascade, org-membership requirement, cycle + non-empty guards).
  - `tsc --noEmit` clean (api+web); backend `eslint` clean; `nest build` + `vite build` pass.
  - live smoke vs compose Mongo (23 checks): create (manager) / slug-dup-409 / invite / private-hidden-from-nonmember / private-direct-404 / add-reader / reader-visible / reader-create-cat-403 / root+child / tree-shape / cycle-422 / nonempty-422 / reader-update-403 / cross-org-404 / no-confirm-422 / delete-204 + gone/members/cats-404. Three initial harness FAILs re-run correctly (PS5 `.Count`/`StatusCodeVariable` artifacts, app behavior proven correct).
- Test data in dev Mongo only (`p3-*` KBs/users). Next: Phase 4 Articles.

## Phase 4 — completed 2026-11-04 ✅
- Backend `articles` module (routes `knowledge-bases/:kbId/articles`): create draft (Tiptap `type:doc` validated, `contentText` auto-derived, slug unique per KB, tags upserted org-wide + deduped, category must belong to KB), optimistic-concurrency update (stale `version` → 409 carrying the current doc for the conflict dialog), soft-delete, publish/unpublish/archive/restore with legal-transition 422s, paginated list (status/category±subtree/tag/`$text` search/author filters), related (shared tags/category, published only), per-KB tag cloud with counts. Permissions: read = any KB-visible member; write = manager/contributor/org-admin (403); transitions + delete = manager/org-admin; cross-KB/org ids → 404 (no leak).
- KB delete now cascades articles + versions in the same transaction (documents retained); category delete rejects when non-empty **or** referenced by articles (422).
- Frontend: `/kbs/:kbId/articles` list (status/search/tag filters, manager delete), `/new` + `/:articleId/edit` Tiptap editor (toolbar, 3s-debounce autosave with saved-indicator, 409 conflict dialog with reload-server / overwrite-with-mine), `/:articleId` view (read-only Tiptap renderer, status actions, related links, view-count), KB detail links to the article list, fa/en strings.
- Verification (all green, executed 2026-11-04):
  - unit: **44/44** (incl. 8 new article rule tests: reader-403, invalid-doc 422, slug-dup 409, stale-409 with current payload, version bump, publish-422, cross-category 404, missing 404).
  - `tsc --noEmit` clean (api+web); backend `eslint` clean; `nest build` + `vite build` pass; `docker compose config` valid.
  - live smoke vs compose Mongo (29 checks): login/kb-create/bad-doc-422/create-v1-draft/slug-dup-409/reader-add/reader-create-403/reader-list/get-by-slug+viewCount/stale-409/update-v2/reader-update-403/reader-publish-403/publish/double-publish-422/second-create/related-empty/related-shared-tag/tags-with-counts/cross-org-404/set-category/cat-with-article-422/archive/restore/unpublish/unpublish-again-422/KB-cascade-delete + articles/members-404. Three initial FAILs re-run correctly (harness path typos missing `/articles/`, app behavior proven correct).
- Test data in dev Mongo only (`p4-*` users/KBs; cascade test deleted `p4-kb`). Debt: frontend bundle ~711kB (Tiptap; code-split deferred to Phase 9); search is keyword `$text` only (full search UI lands in Phase 7); versions insert-only snapshots land in Phase 5 (version counter already monotonic). Next: Phase 5 Documents & Versioning.
- [ ] Root: `docker-compose.yml`, `.env.example`, `.gitignore`, `README.md`, `package.json` (workspaces).
- [ ] Backend scaffold + strict TS + lint + env + logging + filters + health + swagger + Prisma schema/seed.
- [ ] Frontend scaffold + Tailwind + Router + Query + i18n + AppShell.
- [ ] Verification: `tsc --noEmit`, `npm run build` (api+web), `docker compose config`, `prisma validate`, smoke tests.
- Known issues: psql CLI absent on host (use containerized pg); network-dependent `npm install` pending.
- Next: scaffold backend `package.json`/`src`, frontend `package.json`/`src`, then install+build.

## Gate checklist template (per phase)
- [ ] Files reviewed · arch consistent · SoC · naming · no dup · no needless abstraction
- [ ] Errors/validation/authz/DB integrity checked
- [ ] Tests run + results recorded · `tsc --noEmit` clean · builds pass
- [ ] Docs (incl. this file) updated · debt listed honestly
