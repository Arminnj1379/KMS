# Progress Tracker

> Updated after every phase (see task §10). Legend: ✅ done · 🟡 partial · ⬜ not started · 🛑 blocked.

## Current: Phase 2 ✅ complete — next: Phase 3 KB Foundation

| Phase | Status | Notes |
|---|---|---|
| Phase 0 Inspection & Design | ✅ | Empty repo confirmed; 7 docs; module DAG + ER + FTS + state machine. |
| Phase 1 Foundation | ✅ | Verified green (builds, tsc, 3 tests, runtime health/ready/docs, compose db). MinIO pull blocked in sandbox (documented). |
| 2 Identity & Access | ✅ | Backend: identity/users/orgs/permissions modules, global JWT+roles+throttle guards. Frontend: login/register/profile/admin, RequireAuth, 401 handling. |
| 3 KB Foundation | ⬜ | — |
| 4 Articles | ⬜ | — |
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
