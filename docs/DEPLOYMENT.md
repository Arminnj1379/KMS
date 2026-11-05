# Deployment Guide — KMS

Single-host Docker Compose deployment. Two images are built from this repo
(`api` from `backend/`, `web` from `frontend/`); MongoDB and MinIO come
from public images. No external services are required.

## 1. Prerequisites

- Docker Engine 24+ with the Compose plugin.
- A host with at least 2 GB RAM (MongoDB replica set + API + web + MinIO).
- Outbound access to Docker Hub on first boot (images: `mongo:8.0`,
  `minio/minio`, `minio/mc`, `node:20-alpine` / `nginx:alpine` for builds).

## 2. Configuration

Copy the example env file and edit secrets:

```sh
cp .env.example .env
```

| Variable | Required | Default | Notes |
|---|---|---|---|
| `MONGO_DB` | no | `kms` | Database name (compose + API). |
| `NODE_ENV` | no | `production` (compose) | `development` enables `/api/docs` (Swagger) and Mongoose `autoIndex`. |
| `API_PREFIX` | no | `api` | All routes live under `/api`. |
| `CORS_ORIGINS` | no | `http://localhost:5173` | Comma-separated allowlist for the SPA origin(s). |
| `JWT_ACCESS_SECRET` | **yes** | — | ≥ 32 chars. Generate: `openssl rand -base64 48`. |
| `JWT_ACCESS_TTL` | no | `900` | Access-token lifetime, seconds. |
| `JWT_REFRESH_TTL_DAYS` | no | `7` | Refresh-session lifetime, days. |
| `STORAGE_DRIVER` | no | `s3` | `s3` (MinIO/AWS) or `local` (single-replica dev/offline). |
| `UPLOADS_DIR` | no | `./uploads` | Only for `local` driver; mount a volume in compose for persistence. |
| `S3_ENDPOINT` | for `s3` | `http://minio:9000` (compose) | AWS S3 endpoint for prod without MinIO. |
| `S3_REGION` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` / `S3_FORCE_PATH_STYLE` | for `s3` | see compose | `FORCE_PATH_STYLE=true` for MinIO; `false` for AWS. |
| `VITE_API_URL` | no | `http://localhost:3000/api` | Baked into the web image **at build time**. |

> `JWT_ACCESS_SECRET` has a placeholder default in compose — never ship it.
> The API refuses to boot without `MONGODB_URI` (compose sets it).

## 3. First boot

```sh
docker compose up -d --build
docker compose ps                    # mongo healthy, mongo-init exited 0
docker compose exec api npm run db:indexes   # explicit index build (prod has autoIndex off)
docker compose exec api npm run db:seed      # demo org + admin@kms.local / ChangeMe123!
```

Then open `http://<host>:5173` (web) and check `http://<host>:3000/api/ready`
(`{"status":"ok","checks":{"database":"up","storage":"up"}}`) and
`http://<host>:3000/api/health`.

Change the seed passwords immediately (`admin@kms.local`,
`sara@kms.local`): profile → change password, or invite real users and
deactivate the demo accounts.

## 4. Production notes

- **Replica set is mandatory.** Multi-document transactions (register,
  refresh rotation, KB cascade, review decisions) require `rs0`
  (`mongo --replSet rs0` + one-shot `mongo-init`). Standalone Mongo is
  unsupported.
- **Indexes.** `autoIndex` is `false` when `NODE_ENV=production`; run
  `npm run db:indexes` after every deploy that touches
  `backend/src/common/mongo/schemas/*` (idempotent; 17 collections).
  The hot-path index review (Phase 9, `backend/scripts/explain-phase9.js`)
  confirmed `IXSCAN` on inbox/audit/search/member queries; the lone
  `SORT` stage (article list ordering) is an in-memory sort over an
  already-filtered page and is acceptable until a KB exceeds ~10k articles.
- **Backups.** Snapshot the `mongodata` volume (or `mongodump --uri=...
  --gzip --archive`) nightly; test restores. The legacy PG dump at
  `backups/pg-pre-mongo.dump` is pre-migration history only.
- **Storage.** Compose ships MinIO (private bucket `kms-docs`, no public
  reads). For AWS S3, point `S3_*` at AWS, keep the bucket private, and
  keep `STORAGE_DRIVER=s3` (the app only mints presigned URLs; bytes never
  proxy through Node). `local` mode is single-replica only.
- **Rate limits.** Global 200 req/min/IP; auth register/login 10/min,
  refresh 30/min; document upload-intent/PUT/confirm 30/min (disk/CPU
  abuse surface). Limits are in-memory — a multi-replica API needs a
  shared store (Redis) before scaling horizontally.
- **Security checklist.** Helmet headers on every API response (CSP,
  HSTS, frameguard, nosniff); CORS allowlist, credentials only for the
  SPA origin; Swagger `/api/docs` disabled in production; JWT access
  15 min + opaque rotated refresh (reuse revokes the family); bcrypt 12;
  refresh hashes stored sha256; validation pipe strips unknown fields
  (`forbidNonWhitelisted`); audit log is warn-and-swallow by design
  (monitor `AuditLogsService` warnings, don't rely on it for billing).
- **Frontend.** Rebuild the web image when `VITE_API_URL` changes. Nginx
  serves hashed `/assets/*` with `immutable` caching and SPA fallback;
  `/health` returns `ok`.

## 5. Updating

```sh
git pull
docker compose up -d --build
docker compose exec api npm run db:indexes
docker compose exec api npm run db:seed   # idempotent; safe to re-run
curl -fsS http://localhost:3000/api/ready
```

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| API CrashLoops with `Invalid environment configuration` | Missing/short `JWT_ACCESS_SECRET` or missing `MONGODB_URI`. |
| `/api/ready` → database `down` | `mongo` unhealthy or replica set not initiated; check `mongo-init` logs. |
| 404 on SPA refresh of a deep link | `try_files` fallback missing (stock `nginx.conf` covers it). |
| Uploads fail with S3 errors | Wrong `S3_ENDPOINT`/credentials/bucket; for MinIO keep `S3_FORCE_PATH_STYLE=true`. |
| Client gets 429 quickly behind NAT | In-memory throttle counts the NAT IP; put real-client-IP forwarding (`X-Forwarded-For` + trust proxy) or raise limits. |
