import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
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

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950';

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
    const msg = (error.response.data as { message?: unknown }).message;
    if (typeof msg === 'object' && msg !== null && 'current' in msg) {
      return (msg as { current: Article }).current ?? null;
    }
  }
  return null;
}

const EMPTY_DOC: Record<string, unknown> = { type: 'doc', content: [{ type: 'paragraph' }] };

export function ArticleEditorPage(): JSX.Element {
  const { kbId = '', articleId } = useParams();
  const isCreate = articleId === undefined;
  const navigate = useNavigate();
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
        navigate(`/kbs/${kbId}/articles/${data.slug}`, { replace: true });
      } else {
        const data = await update.mutateAsync({
          version,
          title,
          summary: summary || undefined,
          contentJson: c?.json,
          contentText: c?.text,
          categoryId: categoryId === '' ? null : categoryId,
          tagNames: parseTagNames(tags),
        });
        setVersion(data.version);
        setSavedAt(new Date().toLocaleTimeString('fa-IR'));
      }
    } catch (err) {
      const server = extractConflict(err);
      if (server) setConflict({ server });
      else setError(toApiMessage(err, t('common.error')));
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
    } catch (err) {
      setError(toApiMessage(err, t('common.error')));
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
        <p className="py-16 text-center text-sm text-red-600">
          {toApiMessage(existing.error, t('common.error'))}
        </p>
      );
    }
    return <p className="py-16 text-center text-sm text-slate-500">{t('common.loading')}</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Link to={isCreate ? `/kbs/${kbId}/articles` : `/kbs/${kbId}/articles/${articleId}`} className="text-sm text-brand-600 underline">
        {t('article.backToArticles')}
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isCreate ? t('article.create') : t('article.edit')}</h1>
        {!isCreate && (
          <p className="text-xs text-slate-500">
            {saving ? t('article.saving') : savedAt ? `${t('article.autosaved')}: ${savedAt}` : `v${version}`}
          </p>
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-sm">
          {t('kb.title')}
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
        </label>
        {isCreate && (
          <label className="block text-sm">
            {t('kb.slug')}
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              dir="ltr"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              className={inputClass}
            />
          </label>
        )}
        <label className="block text-sm sm:col-span-2">
          {t('kb.description')}
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className={inputClass} />
        </label>
        <label className="block text-sm">
          {t('kb.categories')}
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            <option value="">{t('article.noCategory')}</option>
            {flatCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.path}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          {t('article.tagsPh')}
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t('article.tagsPh')}
            className={inputClass}
          />
        </label>
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
        <div className="rounded-2xl border border-amber-400 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="font-semibold">{t('article.conflictTitle')}</p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">{t('article.conflictBody')}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onReloadServer}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm dark:border-slate-700"
            >
              {t('article.reloadServer')}
            </button>
            <button
              type="button"
              onClick={() => void onForceSave()}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white"
            >
              {t('article.forceSave')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {create.isError && <p className="text-sm text-red-600">{toApiMessage(create.error, t('common.error'))}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={create.isPending || update.isPending}
          className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {t('common.save')}
        </button>
        {!isCreate && canPublish && (
          <button
            type="button"
            onClick={() => void publish.mutateAsync()}
            disabled={publish.isPending}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
          >
            {t('article.publish')}
          </button>
        )}
      </div>
    </section>
  );
}
