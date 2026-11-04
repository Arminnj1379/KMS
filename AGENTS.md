# AGENTS.md — Working Agreement for AI & Human Contributors

> Applies to the whole `E:\Najafi\KMS` repo. Stack: NestJS+Prisma+Postgres+MinIO / React+Vite+Tailwind+Tiptap. Persian RTL default.

## 1. Mandatory workflow
- Phased execution only: finish the current phase's gate (builds + `tsc --noEmit` + relevant tests + docs update) before starting the next.
- Update `docs/PROGRESS.md` after every phase; log important choices in `docs/DECISIONS.md`.
- Never claim "works" without executed verification. If the environment blocks verification, report it explicitly.

## 2. Architecture rules (enforced in review)
- Modular monolith: `backend/src/modules/<name>/{*.controller.ts,*.service.ts,*.repository.ts, dto/, *.module.ts}`. Controllers HTTP-only; services own rules; repositories own Prisma.
- Cross-module: import only another module's public service (e.g. `ArticlesService`, `PermissionsService`). No cross-module repository/Prisma access. No cycles (direction: approval→articles→kbs→orgs→users→identity; permissions/audit/notifications/search are sinks).
- `common/` never imports from `modules/`. No generic repositories / base CRUD classes / speculative abstractions.
- Frontend: `src/features/<name>/{api.ts,hooks.ts,schemas.ts,components/}` + `pages/` shells + `shared/` primitives. Server state via TanStack Query only. RHF+Zod for forms. No hardcoded Persian strings — use `i18n/fa.json` via `t()`.

## 3. Code quality
- Strict TS everywhere (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`); no `any` without justified `// SAFETY:` comment.
- Small focused functions; meaningful names; no magic values (use `config/` or constants).
- Errors: use NestJS HTTP exceptions with machine `code` (see ARCHITECTURE §3); filter sanitizes output. Never leak stack/SQL/secrets.
- Validation: DTOs with `class-validator` (backend) + Zod (frontend + env). Whitelist + forbidNonWhitelisted.
- DB: Prisma migrations only; every business `where` scoped by `organizationId` from JWT (never client body); multi-write ops in `$transaction`.

## 4. Security checklist (every phase touching auth/data)
- bcrypt cost 12; JWT access 15m + opaque rotated refresh; presigned S3 only; helmet+CORS allowlist+rate-limit on auth; sanitize rendered HTML; audit security-sensitive actions.

## 5. Testing
- Prioritize: auth, authz, org isolation, article lifecycle, workflow transitions, version immutability, search scoping.
- Backend: Jest + supertest for integration; frontend: Vitest for hooks/utils where valuable. No vanity coverage.

## 6. Commands
- Backend: `npm run start:dev --workspace=backend` · `npm run build --workspace=backend` · `npm test --workspace=backend` · `npx prisma migrate dev --schema=backend/prisma/schema.prisma` · `npx prisma validate --schema=backend/prisma/schema.prisma`.
- Frontend: `npm run dev --workspace=frontend` · `npm run build --workspace=frontend` · `npx tsc --noEmit -p frontend`.
- Infra: `docker compose up -d --build` · `docker compose config` · `docker compose ps`.
- Health: `GET /api/health`, `GET /api/ready`, `GET /api/docs` (non-prod).

## 7. UX / i18n
- Default `fa-IR`, `dir=rtl`, Vazirmatn font, Jalali date display, light/dark themes. Every page needs loading/empty/error states. No dead buttons — every CTA wired to a real API or explicitly disabled with reason. Keep `en.json` keys in sync (skeleton allowed until Phase 9).
