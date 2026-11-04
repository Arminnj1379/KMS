# KMS — Enterprise Knowledge Management System

Persian-first (fa-IR, RTL) modular monolith: NestJS + Prisma + PostgreSQL + MinIO / React + Vite + Tailwind + Tiptap.

> Phase 1 (foundation). See `docs/` for requirements, architecture, DB design, plan, decisions, progress.

## Quick start (local, without Docker)

```bash
cp .env.example .env
npm install
npx prisma migrate dev --schema=backend/prisma/schema.prisma
npm run dev:api      # http://localhost:3000/api/health
npm run dev:web      # http://localhost:5173 (proxies /api → localhost:3000)
```

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up -d --build
# api:   http://localhost:3000/api/health  (/ready, /docs in non-prod)
# web:   http://localhost:5173
# minio: http://localhost:9001
```

## Repo layout

```
docs/        product + architecture + db + plan + decisions + progress
backend/     NestJS modular monolith (src/modules/*, src/common/*, prisma/)
frontend/    React feature-based app (src/features/*, src/pages/*, src/shared/*)
docker-compose.yml  db + minio + api + web
```

## Commands

| What | Command |
|---|---|
| Typecheck both | `npm run typecheck` |
| Build both | `npm run build` |
| Backend tests | `npm test --workspace=backend` |
| Prisma validate | `npm run prisma:validate` |
| API docs (dev) | `http://localhost:3000/api/docs` |

## Default seed (Phase 2+)

`admin@kms.local / ChangeMe123!` — created by `backend/prisma/seed.ts` (demo org + KB).
Change immediately after first login.
