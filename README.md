# KMS — Enterprise Knowledge Management System (MongoDB)

Persian-first (fa-IR, RTL) modular monolith: NestJS + Mongoose + MongoDB + MinIO / React + Vite + Tailwind + Tiptap.

> Migrated from PostgreSQL/Prisma in 2026-11 (see `docs/DATABASE_DESIGN.md` Appendix A, `docs/DECISIONS.md` D-014..D-018).

## Quick start (local, without Docker)

```bash
cp .env.example .env
docker compose up -d mongo mongo-init   # replica set rs0 (transactions require it)
npm install
npm run db:seed                         # demo org + admin
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
backend/     NestJS modular monolith (src/modules/*, src/common/* incl. common/mongo)
frontend/    React feature-based app (src/features/*, src/pages/*, src/shared/*)
backups/     pre-migration PostgreSQL dump (history only, gitignored)
docker-compose.yml  mongo(+init rs0) + minio + api + web  (+ legacy `db` profile)
```

## Commands

| What | Command |
|---|---|
| Typecheck both | `npm run typecheck` |
| Build both | `npm run build` |
| Backend tests | `npm test --workspace=backend` |
| Seed MongoDB | `npm run db:seed` |
| API docs (dev) | `http://localhost:3000/api/docs` |

## Default seed

`admin@kms.local / ChangeMe123!` — created by `backend/scripts/seed-mongo.ts` (demo org + KB).
Change immediately after first login.
