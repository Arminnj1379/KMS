# Database Design — KMS (PostgreSQL 16 + Prisma)

> Conventions: `snake_case` tables via `@@map`, UUID PKs (`uuid_generate_v4`, Prisma `uuid()`), `created_at/updated_at` on all tables, soft-delete only for `articles` (`deleted_at`) and `documents`; everything else hard-delete with FK restrict where history matters. All money/IDs exact; timestamps `timestamptz`.

## 1. ER Overview

```
organizations 1──* departments
organizations 1──* memberships *──1 users
organizations 1──* knowledge_bases 1──* categories (self-ref) 
knowledge_bases 1──* kb_members *──1 users
knowledge_bases 1──* articles 1──* article_versions
articles *──* tags (article_tags)
articles 1──* article_attachments *──1 documents
articles 1──* review_requests 1──* workflow_history
articles 1──* comments
users 1──* notifications
* ──* audit_logs (polymorphic: resource_type + resource_id, no FK)
users 1──* sessions (refresh families)
```

## 2. Tables (authoritative — mirrors `prisma/schema.prisma`)

### organizations
`id uuid pk, name text, slug citext unique, description text?, logo_url text?, created_at, updated_at`
Index: `slug unique`.

### departments
`id uuid pk, organization_id fk→organizations cascade, parent_id fk→departments self set-null, name text, slug text, path ltree-ish text (materialized '/root/child'), created_at, updated_at`
Unique: `(organization_id, slug)`. Index: `(organization_id, parent_id)`.

### users
`id uuid pk, email citext unique, password_hash text, full_name text, avatar_url text?, locale text default 'fa', is_active bool default true, is_super_admin bool default false, last_login_at?, created_at, updated_at`

### memberships (org membership + org role)
`id uuid pk, organization_id fk cascade, user_id fk cascade, role text (org-admin|member), department_id fk? set-null, created_at, updated_at`
Unique: `(organization_id, user_id)`. Index: `(user_id)`.

### sessions (refresh families)
`id uuid pk, user_id fk cascade, refresh_hash text (sha256), family_id uuid, expires_at, revoked_at?, ip text?, user_agent text?, created_at`
Index: `(user_id)`, `(family_id)`.

### knowledge_bases
`id uuid pk, organization_id fk cascade, title text, slug text, description text?, icon text?, visibility text (private|internal|public) default internal, owner_id fk→users restrict, created_at, updated_at, deleted_at? (not in MVP — hard delete with confirm; documented decision)`
Unique: `(organization_id, slug)`. Index: `(organization_id, visibility)`. FTS: `search_vector tsvector GENERATED` (migration SQL).

### kb_members
`id uuid pk, knowledge_base_id fk cascade, user_id fk cascade, role text (manager|contributor|reviewer|reader), created_at`
Unique: `(knowledge_base_id, user_id)`.

### categories
`id uuid pk, knowledge_base_id fk cascade, parent_id fk self set-null, title text, slug text, description text?, position int default 0, path text (e.g. '/guides/backend'), depth int default 0, created_at, updated_at`
Unique: `(knowledge_base_id, slug)`. Index: `(knowledge_base_id, parent_id, position)`.

### articles
`id uuid pk, organization_id fk cascade, knowledge_base_id fk cascade, category_id fk? set-null, author_id fk restrict, title text, slug text, summary text?, content_json jsonb (tiptap doc), content_text text (plain, for search), content_html text? (sanitized cache), status text (draft|in_review|published|archived) default draft, version int default 1, view_count int default 0, published_at?, deleted_at?, created_at, updated_at`
Unique: `(knowledge_base_id, slug)`. Indexes: `(knowledge_base_id, status, published_at desc)`, `(author_id)`, GIN on `search_vector`.
`search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'')||' '||coalesce(summary,'')||' '||coalesce(content_text,''))) STORED` (migration raw SQL; Prisma `Unsupported` passthrough).

### article_versions (immutable)
`id uuid pk, article_id fk cascade, version int, title text, summary text?, content_json jsonb, content_text text?, changelog text?, created_by fk restrict, created_at`
Unique: `(article_id, version)`. Never updated/deleted by app code (DB revoke not needed in MVP; enforced in service + test).

### tags / article_tags
`tags: id uuid pk, organization_id fk cascade, name citext, slug text, created_at` Unique `(organization_id, slug)`.
`article_tags: article_id fk cascade, tag_id fk cascade` PK composite.

### documents / article_attachments
`documents: id uuid pk, organization_id fk cascade, uploader_id fk restrict, object_key text unique, filename text, mime text, size_bytes int, checksum_sha256 text?, created_at`
`article_attachments: id uuid pk, article_id fk cascade, document_id fk cascade, created_by fk, created_at` Unique `(article_id, document_id)`.

### comments (article-scoped, MVP flat + optional parent for one-level threads)
`id uuid pk, article_id fk cascade, author_id fk restrict, parent_id fk self cascade?, body text, created_at, updated_at`
Index: `(article_id, created_at)`.

### review_requests + workflow_history
`review_requests: id uuid pk, article_id fk cascade, requester_id fk, reviewer_id fk, status text (pending|approved|rejected|cancelled) default pending, comment text?, decided_at?, created_at, updated_at` Index `(article_id, status)`, `(reviewer_id, status)`.
`workflow_history: id uuid pk, article_id fk cascade, from_status text, to_status text, actor_id fk, comment text?, created_at` Index `(article_id, created_at)`.

### notifications
`id uuid pk, user_id fk cascade, type text, title text, body text?, data jsonb?, is_read bool default false, created_at` Index `(user_id, is_read, created_at desc)`.

### audit_logs (append-only)
`id uuid pk, organization_id fk? (nullable for login events), actor_id fk?, action text (e.g. article.publish), resource_type text, resource_id text, metadata jsonb?, ip text?, created_at` Index `(organization_id, created_at desc)`, `(resource_type, resource_id)`.

## 3. Integrity Rules

- Every `articles.organization_id` must equal its KB's `organization_id` (enforced in service tx on create/move; DB trigger deferred — documented as tech debt with test coverage instead).
- Deleting a KB requires explicit `?confirm=true` and cascades categories/articles/versions/attachments-links (documents retained for audit; orphan cleanup job out of scope).
- `article_versions` insert-only: service never calls update/delete; integration test asserts row count monotonic.
- Refresh `family_id` reuse (unknown hash presented) → revoke whole family.

## 4. Index Strategy (query-driven)

- Auth: `users.email`, `sessions.family_id`, `memberships(user_id)`.
- Lists: `articles(kb, status, published_at)`, `categories(kb, parent, position)`, `notifications(user, read, created)`.
- Search: GIN `articles.search_vector`, GIN trigram on `articles.title` (`pg_trgm`), B-tree `article_tags(tag_id)`.
- Audit: BRIN-ish btree on `audit_logs(created_at)` + composite org+created.

## 5. Migrations

Prisma migrations (`backend/prisma/migrations/*`), plus `extensions.sql` enabling `pgcrypto, pg_trgm, unaccent, citext`. `search_vector` maintained via `GENERATED` column (no trigger needed on PG12+). Seed: demo org + admin (`admin@kms.local` / `ChangeMe123!`), one KB, categories, 3 articles, tags.
