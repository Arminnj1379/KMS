# Architecture — KMS Modular Monolith

> Date: 2026-11-04, migrated to MongoDB 2026-11-04 (D-014..D-018). Stack: React 18 + TS strict + Vite + Tailwind + shadcn-style UI + React Router + TanStack Query + RHF + Zod + Tiptap / NestJS 10 + TS strict + Mongoose 8 + MongoDB 8 (replica set rs0) + MinIO. Redis: deferred (only for refresh-token reuse cache / rate-limit when justified). No Kafka/RabbitMQ in MVP.

## 1. System Overview

```
┌─────────────┐      REST/JSON (JWT)      ┌──────────────────────────────┐
│  Frontend   │ ◄──────────────────────► │  Backend (NestJS monolith)   │
│ React SPA   │      presigned S3 URLs   │  modules/* (bounded ctx)     │
└──────┬──────┘                          └──────┬─────────┬───────────────┘
       │                                     │ Mongoose│ S3 (MinIO)
       │ vite proxy / direct                 ▼         ▼
       │                              ┌──────────┐ ┌────────┐
       └──────────────────────────────│ MongoDB  │ │ MinIO  │
                                      │ (rs0)    │ │        │
                                      └──────────┘ └────────┘
```

Deployment (MVP): single `docker-compose.yml` → `mongo`, `mongo-init` (rs.initiate, one-shot idempotent), `api`, `web` (nginx static), `minio`, `minio-init` (bucket creation). Legacy `db` (Postgres) runs only on the `legacy` profile for backup verification — no app code connects to it. No separate auth server, no gateway.

## 2. Backend Layout (NestJS)

```
backend/
  src/
    main.ts                 # bootstrap: helmet, cors, validation, swagger, logging
    app.module.ts           # wiring only
    config/                 # env validation (zod), app.config, storage.config, auth.config
    common/                 # decorators, guards, filters, interceptors, utils (no business logic)
      decorators/ (current-user, public, roles)
      guards/ (jwt-auth.guard, roles.guard, resource guards per module)
      filters/ (http-exception.filter — sanitized error envelope)
      interceptors/ (logging, audit-context)
      mongo/ (mongo.module — global connection + all schemas, mongo-errors, object-id, transaction.helper)
    modules/
      identity/             # authN: login/register/refresh/me/password, JWT strategy
      users/                # user CRUD, profile (authZ via CASL-lite custom)
      organizations/        # orgs + departments + memberships
      knowledge-bases/      # KB CRUD + members
      categories/           # tree CRUD + move
      articles/             # articles CRUD + publish/unpublish/archive + autosave
      article-versions/     # immutable snapshots + restore-as-new-version + diff support
      documents/            # upload intent → presigned URL, confirm, attachments
      permissions/          # role definitions + resource-policy evaluation (public API for other modules)
      approval-workflow/    # review requests + transitions + history (state machine)
      search/               # DTO + service façade over Mongo text index (swappable)
      notifications/        # in-app CRUD + emitter interface (sync MVP)
      audit-logs/           # append-only writer + query (admin)
      health/               # /health /ready (mongo ping + storage ping)
```

### Module contract rules
1. Controllers: HTTP only (DTO mapping, status codes). No Mongoose imports in controllers.
2. Services hold business rules; persistence = injected `Model<T>` calls, always `.lean()` + mapped to plain shapes (thin, no cross-module model access, documents never cross service boundaries).
3. Cross-module: import only the *public* service/interface of another module (e.g. `ArticlesService`, `PermissionsService.can()`), never its model. Documented in each module README header.
4. No circular imports: dependency direction is
   `approval-workflow → articles → knowledge-bases → organizations → users → identity`,
   with `permissions`, `audit-logs`, `notifications`, `search` as leaves/sinks (they depend on nothing business-logic).
   Use `forwardRef` only as a code smell signal — refactor instead.
5. Shared kernel (`common/`) must not import from `modules/`.

## 3. Request Lifecycle

`helmet → cors → rate-limit → request-id → logging → jwt-auth (unless @Public) → roles → resource-guard → validation_pipe (whitelist, forbidNonWhitelisted) → controller → service (withTransaction where multi-doc) → mongoose model (.lean()) → audit-log (fire-and-forget via AuditService, never blocking main tx failure) → exception-filter (envelope {statusCode,message,code,requestId})`.

Error codes: `UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE, RATE_LIMITED, INTERNAL`. Never leak stack/driver errors in production.

## 4. Auth & Authorization

- Passwords: bcryptjs cost 12. Login rate-limited (5/min/IP + account lockout counter in DB, not implemented fully in Phase 1 — hook documented).
- Tokens: access JWT 15m (`sub, orgId, roles[]`), refresh opaque random 32B hashed in DB (rotation, reuse → revoke family). MVP stores refresh in the `sessions` collection.
- RBAC roles per KB membership + org role. `PermissionsService.requireMember/requireAdmin` centralizes org-scope checks; resource guards call it.
- Org isolation: every `where` includes `organizationId` derived from JWT, never from client body; invalid ObjectIds map to 404 (no leak).

## 5. Frontend Layout (feature-based)

```
frontend/src/
  main.tsx, App.tsx (router + providers + theme), index.css (tailwind + tokens + fonts)
  app/ (providers: query-client, theme, auth-context-light)
  pages/ (route shells only: LoginPage, DashboardPage, KbDetailPage, ArticleEditorPage, ArticleViewPage, SearchPage, AdminPage, NotFoundPage)
  features/
    auth/ (api.ts, hooks.ts, schemas.ts, LoginForm.tsx, RequireAuth.tsx)
    knowledge-bases/ (api.ts, hooks.ts, KbCard.tsx, KbFormDialog.tsx)
    categories/ (api.ts, CategoryTree.tsx)
    articles/ (api.ts, hooks.ts, schemas.ts, ArticleEditor.tsx (tiptap), ArticleView.tsx, StatusBadge.tsx)
    search/ (api.ts, SearchBar.tsx, Filters.tsx)
    notifications/ (api.ts, Bell.tsx)
    admin/ (users table, audit table)
  shared/ (components/ui/* shadcn-style primitives, layout/AppShell.tsx, hooks/, lib/ (api-client.ts, format-fa.ts, cn.ts), validation/)
  i18n/ (fa.json, en.json skeleton; fa default, dir=rtl)
  types/ (server DTO mirrors, hand-written to avoid codegen lock-in MVP)
```

Rules: server state only via TanStack Query (`queryKeys` per feature); forms via RHF+Zod; no global store except auth session + theme; components <200 lines, logic in hooks.

## 6. Data Flow (article edit MVP)

`Tiptap onUpdate (debounced 2s) → RHF dirty → PUT /articles/:id (If-Unmodified-Since: updatedAt) → 200 (new updatedAt) | 409 (conflict → show resolve dialog: keep mine / reload theirs) → on publish → POST /articles/:id/publish → creates article_versions snapshot in same tx → notification + audit`.

## 7. Approval State Machine

```
draft ──submit──► in_review ──approve──► published
  ▲                 │  │                    │ archive
  └──reject─────────┘  └──cancel──────────► draft (author or kb-manager)
published ──unpublish──► draft (kb-manager+)
any ──archive──► archived (kb-manager+; read-only thereafter except restore-to-draft)
```

Enforced in `ApprovalWorkflowService.transition()` — single choke point, invalid transitions throw `UnprocessableEntity`. All transitions write `workflow_history` + `audit_logs` in the same transaction.

## 8. Storage & Files

Client: `POST /documents/upload-intent {filename,mime,size,articleId?}` → server validates (allowlist, quota) → returns presigned PUT + object key → client PUTs directly to MinIO → `POST /documents/confirm {key}` → row created. Download via presigned GET (5 min TTL). Bucket `kms-docs` private. S3 client abstracted (`StorageService`) so AWS S3 is a config change.

## 9. Search Design (swap-ready)

`SearchService` interface: `search(ctx, SearchQueryDto): Paginated<ArticleHit>`. MVP impl `MongoSearchService` uses a MongoDB text index on `articles(title, summary, contentText)` (language `none` — Persian has no stemmer; keyword matching) + regex fallback, scoped by KB membership. Elasticsearch/Atlas Search later = new provider behind same token, zero article-module changes.

## 10. Observability & Ops

- Logging: pino (`nestjs-pino`), JSON in prod, pretty in dev; `x-request-id` propagated; no PII/passwords in logs.
- Health: `/health` (liveness, no deps), `/ready` (mongo + storage ping).
- Swagger: `/docs` (dev/staging only, bearer auth).
- Schema/index rollout: Mongoose schemas are code; indexes build on startup (`autoIndex: true` in dev/test, `false` in prod with an explicit index step — Phase 9).

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Tiptap JSON schema drift | Zod schema validation on save; `schemaVersion` field; migration function on load |
| Category tree cycles | `move` validates target not in own subtree (path prefix check) in one transaction |
| N+1 article lists | Cursor pagination, batched lean queries, review text-index search for search |
| Refresh theft | Rotation + hashed storage + reuse detection revokes family |
| MinIO presign leakage | Short TTL, private bucket, server-side mime/size recheck on confirm |
