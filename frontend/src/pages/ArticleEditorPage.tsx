import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, Loader2, Megaphone, Save, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { formatFaDate, formatFaDay, formatFaNumber } from '../shared/lib/format-fa';
import { useToast } from '../shared/ui/Toast';
import { Button } from '../shared/ui/Button';
import { Field, Select, TextInput } from '../shared/ui/Field';
import { Badge } from '../shared/ui/Badge';
import { Skeleton } from '../shared/ui/Feedback';
import { ArticleEditor } from '../features/articles/components/ArticleEditor';
import { ArticleStatusBadge } from '../features/articles/components/ArticleStatusBadge';
import { AttachmentsCard } from '../features/documents/AttachmentsCard';
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

function EditorSkeleton(): JSX.Element {
  return (
    <div className="mx-auto max-w-[760px] space-y-6 pt-10" aria-label={t('common.loading')}>
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-80" />
    </div>
  );
}

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
  const [metaOpen, setMetaOpen] = useState(true);
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
      return <p className="mx-auto max-w-3xl py-16 text-center text-sm text-danger">{toApiMessage(existing.error, t('common.error'))}</p>;
    }
    return <EditorSkeleton />;
  }

  const current = !isCreate ? existing.data : undefined;
  const saveBusy = create.isPending || update.isPending;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-10">
      <div className="sticky top-14 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-md sm:px-6 lg:px-10">
        <Link
          to={isCreate ? `/kbs/${kbId}/articles` : `/kbs/${kbId}/articles/${articleId}`}
          className="btn-icon -ms-2"
          aria-label={t('article.backToArticles')}
          title={t('article.backToArticles')}
        >
          <ArrowRight size={18} />
        </Link>

        <span className="min-w-0 truncate text-[13px] text-ink-3" role="status" aria-live="polite">
          {saving ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              {t('article.savingNow')}
            </span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-success" aria-hidden />
              {t('article.savedAt', { time: savedAt })}
            </span>
          ) : current ? (
            t('article.versionLabel', { version: formatFaNumber(version) })
          ) : (
            t('article.newDraftHint')
          )}
        </span>

        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMetaOpen((v) => !v)}
            aria-pressed={metaOpen}
            className="hidden lg:inline-flex"
          >
            <SlidersHorizontal size={15} />
            {t('article.metaToggle')}
          </Button>
          {!isCreate && canPublish && (
            <Button
              variant="secondary"
              size="sm"
              disabled={publish.isPending}
              onClick={() =>
                void (async () => {
                  try {
                    await publish.mutateAsync();
                    toast.success(t('article.publishedToast'));
                    navigate(`/kbs/${kbId}/articles/${articleId}`);
                  } catch (err) {
                    toast.error(toApiMessage(err, t('common.error')));
                  }
                })()
              }
            >
              <Megaphone size={15} />
              {t('article.publishNow')}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => void onSave()} disabled={saveBusy}>
            <Save size={15} />
            {t('article.saveDraft')}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_288px] lg:px-10">
        <div className="min-w-0">
          <div className="mx-auto max-w-[760px] space-y-5">
            {conflict && (
              <div className="rounded-card border border-warn/30 bg-warn-soft p-4" role="alert">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-warn">
                  <TriangleAlert size={16} aria-hidden />
                  {t('article.conflictTitle')}
                </p>
                <p className="mt-1.5 text-[13.5px] leading-7 text-ink-2">{t('article.conflictBody')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
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
            {create.isError && (
              <p className="form-error" role="alert">
                {toApiMessage(create.error, t('common.error'))}
              </p>
            )}

            <div className="surface px-6 py-10 sm:px-12 sm:py-12">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                placeholder={t('article.titlePh')}
                aria-label={t('kb.title')}
                className="w-full bg-transparent text-[30px] font-bold leading-[1.5] text-ink placeholder:text-ink-4 focus:outline-none"
              />
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t('article.summaryPh')}
                aria-label={t('kb.description')}
                className="mt-3 w-full resize-none bg-transparent text-[16px] leading-8 text-ink-2 placeholder:text-ink-4 focus:outline-none"
              />
              <div className="my-8 border-t border-line" />
              {!isCreate && existing.data ? (
                <ArticleEditor key={existing.data.id} initialContent={existing.data.contentJson} onChange={onEditorChange} />
              ) : (
                isCreate && <ArticleEditor initialContent={EMPTY_DOC} onChange={onEditorChange} autofocus />
              )}
            </div>
          </div>
        </div>

        <aside className={metaOpen ? 'space-y-5 lg:sticky lg:top-32 lg:self-start' : 'hidden'}>
          <section className="surface space-y-5 p-5" aria-label={t('article.metaPanel')}>
            <h2 className="section-title">{t('article.metaPanel')}</h2>

            <div className="flex flex-wrap items-center gap-2">
              <span className="meta me-1">{t('article.statusLabel')}</span>
              {current ? <ArticleStatusBadge status={current.status} /> : <Badge tone="neutral" dot>{t('article.status_draft')}</Badge>}
              {current && <Badge tone="outline">{t('article.versionLabel', { version: formatFaNumber(version) })}</Badge>}
            </div>
            {current && (
              <p className="meta -mt-2">
                {current.status === 'published'
                  ? t('article.publishedOn', { date: formatFaDay(current.publishedAt ?? current.updatedAt) })
                  : current.status === 'in_review'
                    ? t('article.inReviewHint')
                    : t('article.draftHint')}
              </p>
            )}

            {isCreate ? (
              <Field label={t('article.slugLabel')}>
                <TextInput value={slug} onChange={(e) => setSlug(e.target.value)} required dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
              </Field>
            ) : (
              <div>
                <span className="label">{t('article.slugLabel')}</span>
                <p dir="ltr" className="truncate rounded-control bg-surface-muted px-3 py-2 font-mono text-[13px] text-ink-2">
                  {slug}
                </p>
              </div>
            )}

            <Field label={t('article.categoryLabel')}>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">{t('article.noCategory')}</option>
                {flatCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.path}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('article.tagsLabel')}>
              <TextInput value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('article.tagsPh')} />
            </Field>

            {!isCreate && (
              <Field label={t('article.changelogLabel')}>
                <TextInput
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder={t('article.changelogPh')}
                  maxLength={200}
                />
                <span className="meta mt-1.5 block text-[12px] leading-5">{t('article.changelogHint')}</span>
              </Field>
            )}

            {current && (
              <p className="meta">
                {t('article.lastEdited')}: {formatFaDate(current.updatedAt)}
              </p>
            )}
          </section>

          {current && <AttachmentsCard kbId={kbId} articleId={articleId ?? ''} canWrite />}
        </aside>
      </div>
    </div>
  );
}
