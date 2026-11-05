import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Check, CloudOff, Loader2, Megaphone, Save } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { Field, Select, Textarea, TextInput } from '../shared/ui/Field';
import { ArticleEditor } from '../features/articles/components/ArticleEditor';
import type { Article } from '../features/articles/api';
import {
  useArticle,
  useCreateArticle,
  usePublishArticle,
  useUpdateArticle,
} from '../features/articles/hooks';
import { parseTagNames } from '../features/articles/schemas';
import { useCategories, useKb } from '../features/knowledge-bases/hooks';
import type { CategoryNode } from '../features/knowledge-bases/api';
import { formatFaNumber } from '../shared/lib/format-fa';

function flatten(nodes: CategoryNode[], out: CategoryNode[] = []): CategoryNode[] {
  for (const n of nodes) {
    out.push(n);
    flatten(n.children, out);
  }
  return out;
}

interface Conflict {
  server: Article;
}

function extractConflict(error: unknown): Article | null {
  if (axios.isAxiosError(error) && error.response?.status === 409) {
    const data = error.response.data as { current?: unknown; message?: unknown };
    // Current envelope (Phase 11): top-level `current`. Legacy shape kept
    // for tolerance: `{ message: { current } }`.
    if (data && typeof data === 'object') {
      if (data.current && typeof data.current === 'object') {
        return data.current as Article;
      }
      const msg = data.message;
      if (typeof msg === 'object' && msg !== null && 'current' in msg) {
        return (msg as { current: Article }).current ?? null;
      }
    }
  }
  return null;
}

const EMPTY_DOC: Record<string, unknown> = { type: 'doc', content: [{ type: 'paragraph' }] };

export function ArticleEditorPage(): JSX.Element {
  const { kbId = '', articleId } = useParams();
  const isCreate = articleId === undefined;
  const navigate = useNavigate();
  const toast = useToast();
  const kb = useKb(kbId);
  const existing = useArticle(kbId, articleId ?? '');
  const categories = useCategories(kbId);
  const create = useCreateArticle(kbId);
  const update = useUpdateArticle(kbId, articleId ?? '');
  const publish = usePublishArticle(kbId, articleId ?? '');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [version, setVersion] = useState(1);
  const [changelog, setChangelog] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const contentRef = useRef<{ json: Record<string, unknown>; text: string } | null>(null);
  const dirtyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  // Hydrate the form once when the article loads (edit mode).
  useEffect(() => {
    if (isCreate || hydrated.current || !existing.data) return;
    const a = existing.data;
    setTitle(a.title);
    setSlug(a.slug);
    setSummary(a.summary ?? '');
    setCategoryId(a.categoryId ?? '');
    setTags(a.tagNames.join('، '));
    setVersion(a.version);
    hydrated.current = true;
  }, [isCreate, existing.data]);

  // Debounced autosave (edit mode only): 3s after the last keystroke.
  useEffect(() => {
    if (isCreate || !hydrated.current || conflict) return undefined;
    if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
    dirtyTimer.current = setTimeout(() => {
      void (async () => {
        const c = contentRef.current;
        if (!c || saving) return;
        setSaving(true);
        setError(null);
        try {
          const data = await update.mutateAsync({
            version,
            title,
            summary: summary || undefined,
            contentJson: c.json,
            contentText: c.text,
            categoryId: categoryId === '' ? null : categoryId,
            tagNames: parseTagNames(tags),
          });
          setVersion(data.version);
          setSavedAt(new Date().toLocaleTimeString('fa-IR'));
        } catch (err) {
          const server = extractConflict(err);
          if (server) setConflict({ server });
          else setError(toApiMessage(err, t('common.error')));
        } finally {
          setSaving(false);
        }
      })();
    }, 3000);
    return () => {
      if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, summary, categoryId, tags, version, conflict, isCreate]);

  function onEditorChange(json: Record<string, unknown>, text: string): void {
    contentRef.current = { json, text };
  }

  async function onSave(): Promise<void> {
    setError(null);
    try {
      const c = contentRef.current;
      if (isCreate) {
        const data = await create.mutateAsync({
          title,
          slug,
          summary: summary || undefined,
          contentJson: c?.json ?? EMPTY_DOC,
          contentText: c?.text,
          categoryId: categoryId === '' ? undefined : categoryId,
          tagNames: parseTagNames(tags),
        });
        toast.success(t('article.createdToast'));
        navigate(`/kbs/${kbId}/articles/${data.slug}`, { replace: true });
      } else {
        const note = changelog.trim();
        const data = await update.mutateAsync({
          version,
          title,
          summary: summary || undefined,
          contentJson: c?.json,
          contentText: c?.text,
          categoryId: categoryId === '' ? null : categoryId,
          tagNames: parseTagNames(tags),
          ...(note ? { changelog: note } : {}),
        });
        setVersion(data.version);
        if (note) setChangelog('');
        setSavedAt(new Date().toLocaleTimeString('fa-IR'));
        toast.success(t('common.savedToast'));
      }
    } catch (err) {
      const server = extractConflict(err);
      if (server) setConflict({ server });
      else {
        const msg = toApiMessage(err, t('common.error'));
        setError(msg);
        toast.error(msg);
      }
    }
  }

  /** Overwrite the server copy with local content (uses the server version). */
  async function onForceSave(): Promise<void> {
    if (!conflict) return;
    setError(null);
    try {
      const c = contentRef.current;
      const data = await update.mutateAsync({
        version: conflict.server.version,
        title,
        summary: summary || undefined,
        contentJson: c?.json,
        contentText: c?.text,
        categoryId: categoryId === '' ? null : categoryId,
        tagNames: parseTagNames(tags),
      });
      setVersion(data.version);
      setConflict(null);
      setSavedAt(new Date().toLocaleTimeString('fa-IR'));
      toast.success(t('common.savedToast'));
    } catch (err) {
      const msg = toApiMessage(err, t('common.error'));
      setError(msg);
      toast.error(msg);
    }
  }

  function onReloadServer(): void {
    if (!conflict) return;
    const s = conflict.server;
    setTitle(s.title);
    setSummary(s.summary ?? '');
    setCategoryId(s.categoryId ?? '');
    setTags(s.tagNames.join('، '));
    setVersion(s.version);
    setConflict(null);
  }

  const role = kb.data?.role ?? null;
  const canPublish = role === 'manager' || role === 'org-admin';
  const flatCats = categories.data ? flatten(categories.data) : [];

  if (!isCreate && (existing.isPending || !hydrated.current)) {
    if (existing.isError) {
      return (
        <p className="mx-auto max-w-3xl py-16 text-center text-sm text-rose-600">
          {toApiMessage(existing.error, t('common.error'))}
        </p>
      );
    }
    return <p className="mx-auto max-w-3xl py-16 text-center text-sm text-slate-500">{t('common.loading')}</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={isCreate ? t('article.create') : t('article.edit')}
        breadcrumbs={[
          { label: t('nav.knowledgeBases'), to: '/kbs' },
          ...(kb.data ? [{ label: kb.data.title, to: `/kbs/${kbId}` }] : []),
          { label: t('article.listTitle'), to: `/kbs/${kbId}/articles` },
          { label: isCreate ? t('article.create') : (existing.data?.title ?? t('article.edit')) },
        ]}
        actions={
          !isCreate ? (
            <span className="meta flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800" role="status">
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  {t('article.saving')}
                </>
              ) : savedAt ? (
                <>
                  <Check size={13} className="text-emerald-600" />
                  {t('article.autosaved')}: {savedAt}
                </>
              ) : (
                <>
                  <CloudOff size={13} />
                  {t('article.versionLabel', { version: formatFaNumber(version) })}
                </>
              )}
            </span>
          ) : undefined
        }
      />

      <div className="surface grid gap-4 p-5 sm:grid-cols-2">
        <Field label={t('kb.title')}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </Field>
        {isCreate && (
          <Field label={t('kb.slug')}>
            <TextInput value={slug} onChange={(e) => setSlug(e.target.value)} required dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </Field>
        )}
        <div className="sm:col-span-2">
          <Field label={t('kb.description')}>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} maxLength={500} />
          </Field>
        </div>
        <Field label={t('kb.categories')}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t('article.noCategory')}</option>
            {flatCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.path}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('article.tagsPh')}>
          <TextInput value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('article.tagsPh')} />
        </Field>
        {!isCreate && (
          <div className="sm:col-span-2">
            <Field label={t('article.changelogPh')}>
              <TextInput
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder={t('article.changelogHint')}
                maxLength={200}
              />
            </Field>
          </div>
        )}
      </div>

      {!isCreate && existing.data ? (
        <ArticleEditor
          key={existing.data.id}
          initialContent={existing.data.contentJson}
          onChange={onEditorChange}
        />
      ) : (
        isCreate && <ArticleEditor initialContent={EMPTY_DOC} onChange={onEditorChange} autofocus />
      )}

      {conflict && (
        <div className="surface border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/40" role="alert">
          <p className="flex items-center gap-2 text-sm font-bold">
            <AlertTriangle size={16} className="text-amber-600" />
            {t('article.conflictTitle')}
          </p>
          <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">{t('article.conflictBody')}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={onReloadServer}>
              {t('article.reloadServer')}
            </Button>
            <Button variant="primary" size="sm" onClick={() => void onForceSave()}>
              {t('article.forceSave')}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      {create.isError && <p className="form-error" role="alert">{toApiMessage(create.error, t('common.error'))}</p>}

      <div className="sticky bottom-4 flex items-center gap-2 rounded-card border bg-white/90 p-2.5 shadow-pop backdrop-blur dark:bg-slate-900/90" style={{ borderColor: 'var(--line)' }}>
        <Button
          variant="primary"
          onClick={() => void onSave()}
          disabled={create.isPending || update.isPending}
        >
          <Save size={16} />
          {t('common.save')}
        </Button>
        {!isCreate && canPublish && (
          <Button
            variant="secondary"
            disabled={publish.isPending}
            onClick={() => void (async () => {
              try {
                await publish.mutateAsync();
                toast.success(t('article.publishedToast'));
                navigate(`/kbs/${kbId}/articles/${articleId}`);
              } catch (err) {
                toast.error(toApiMessage(err, t('common.error')));
              }
            })()}
          >
            <Megaphone size={16} />
            {t('article.publish')}
          </Button>
        )}
        <Link to={isCreate ? `/kbs/${kbId}/articles` : `/kbs/${kbId}/articles/${articleId}`} className="btn-ghost btn-sm ms-auto">
          {t('article.backToArticles')}
        </Link>
      </div>
    </section>
  );
}
