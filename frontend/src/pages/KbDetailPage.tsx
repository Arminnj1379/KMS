import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Crown, FileText, FolderTree, Globe, Lock, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { t, type I18nKey } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { cn } from '../shared/lib/cn';
import { formatFaNumber, formatFaRelative } from '../shared/lib/format-fa';
import { useToast } from '../shared/ui/Toast';
import { Avatar, PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { ConfirmDialog, Dialog, DialogFooter } from '../shared/ui/Dialog';
import { Field, Select, Textarea, TextInput } from '../shared/ui/Field';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { Badge, type Tone } from '../shared/ui/Badge';
import { CategoryTree } from '../features/knowledge-bases/components/CategoryTree';
import {
  useAddKbMember,
  useCategories,
  useDeleteKb,
  useKb,
  useKbMembers,
  useRemoveKbMember,
  useUpdateKb,
  useUpdateKbMemberRole,
} from '../features/knowledge-bases/hooks';
import { useArticles } from '../features/articles/hooks';
import { ArticleStatusBadge } from '../features/articles/components/ArticleStatusBadge';

const KB_ROLES = ['manager', 'contributor', 'reviewer', 'reader'] as const;
const TABS = ['overview', 'categories', 'members'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS = {
  overview: 'kb.tabOverview',
  categories: 'kb.tabCategories',
  members: 'kb.tabMembers',
} as const;

const roleTone: Record<string, Tone> = { manager: 'accent', contributor: 'success', reviewer: 'warn', reader: 'neutral' };

const visibilityMeta = {
  private: { icon: Lock, tone: 'neutral', label: 'kb.visShortPrivate' },
  internal: { icon: Users, tone: 'accent', label: 'kb.visShortInternal' },
  public: { icon: Globe, tone: 'success', label: 'kb.visShortPublic' },
} as const;

function isTab(value: string | null): value is Tab {
  return value !== null && (TABS as readonly string[]).includes(value);
}

function roleLabel(role: string): string {
  if (role === 'org-admin') return t('roles.orgAdmin');
  return t(`kb.role_${role}` as I18nKey);
}

export function KbDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const kb = useKb(id);
  const members = useKbMembers(id);
  const categories = useCategories(id);
  const recent = useArticles(id, { sort: 'updated', pageSize: 5 });
  const updateKb = useUpdateKb(id);
  const deleteKb = useDeleteKb(id);
  const addMember = useAddKbMember(id);
  const updateRole = useUpdateKbMemberRole(id);
  const removeMember = useRemoveKbMember(id);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('internal');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [invite, setInvite] = useState({ email: '', role: 'reader' });

  const tabParam = searchParams.get('tab');
  const tab: Tab = isTab(tabParam) ? tabParam : 'overview';

  function setTab(next: Tab): void {
    setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true });
  }

  if (kb.isPending) {
    return (
      <section className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-96" />
        <div className="surface p-6">
          <Skeleton className="h-24" />
        </div>
      </section>
    );
  }
  if (kb.isError || !kb.data) {
    return <InlineError message={toApiMessage(kb.error, t('common.error'))} onRetry={() => void kb.refetch()} />;
  }

  const data = kb.data;
  const canManage = data.role === 'manager' || data.role === 'org-admin';
  const canWrite = canManage || data.role === 'contributor';
  const visMeta = visibilityMeta[data.visibility as keyof typeof visibilityMeta] ?? visibilityMeta.internal;
  const VisIcon = visMeta.icon;

  function openEdit(): void {
    setTitle(data.title);
    setDescription(data.description ?? '');
    setVisibility(data.visibility);
    setEditing(true);
  }

  async function onSave(): Promise<void> {
    try {
      await updateKb.mutateAsync({
        title,
        description: description || undefined,
        visibility: visibility as 'private' | 'internal' | 'public',
      });
      toast.success(t('common.savedToast'));
      setEditing(false);
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  async function onDelete(): Promise<void> {
    try {
      await deleteKb.mutateAsync();
      toast.success(t('kb.deletedToast'));
      navigate('/kbs', { replace: true });
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
      setConfirmDelete(false);
    }
  }

  async function onInvite(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    try {
      await addMember.mutateAsync(invite);
      toast.success(t('kb.memberAddedToast'));
      setInvite({ email: '', role: 'reader' });
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  async function onRole(userId: string, role: string): Promise<void> {
    try {
      await updateRole.mutateAsync({ userId, role });
      toast.success(t('common.savedToast'));
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  async function onRemove(userId: string, fullName: string): Promise<void> {
    try {
      await removeMember.mutateAsync(userId);
      toast.success(t('kb.memberRemovedToast', { name: fullName }));
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.title}
        description={data.description ?? undefined}
        breadcrumbs={[{ label: t('nav.knowledgeBases'), to: '/kbs' }]}
        actions={
          <>
            {canManage && (
              <>
                <Button variant="ghost" onClick={openEdit}>
                  <Pencil size={15} />
                  {t('common.edit')}
                </Button>
                <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={15} />
                  {t('kb.delete')}
                </Button>
              </>
            )}
            <Link to={`/kbs/${data.slug}/articles`} className="btn-secondary">
              <FileText size={16} />
              {t('article.listTitle')}
            </Link>
            {canWrite && (
              <Link to={`/kbs/${data.slug}/articles/new`} className="btn-primary">
                <FileText size={16} />
                {t('article.create')}
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Badge tone={visMeta.tone} className="gap-1.5">
          <VisIcon size={12} aria-hidden />
          {t(visMeta.label)}
        </Badge>
        {data.role && (
          <span className="flex items-center gap-2">
            <span className="meta">{t('kb.yourRole')}</span>
            <Badge tone={roleTone[data.role] ?? 'neutral'}>{roleLabel(data.role)}</Badge>
          </span>
        )}
        <span dir="ltr" className="meta font-mono">
          {data.slug}
        </span>
      </div>

      <div role="tablist" aria-label={data.title} className="flex gap-7 overflow-x-auto border-b border-line">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className="tab"
          >
            {t(TAB_LABELS[name])}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="surface overflow-hidden lg:col-span-2">
            <div className="panel-head justify-between">
              <h2 className="section-title">{t('kb.recentArticles')}</h2>
              <Link to={`/kbs/${data.slug}/articles`} className="text-[13px] font-medium text-accent hover:underline">
                {t('kb.viewAllArticles')}
              </Link>
            </div>
            {recent.isPending && (
              <div className="space-y-3 p-5">
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
              </div>
            )}
            {recent.isError && (
              <div className="p-5">
                <InlineError message={toApiMessage(recent.error, t('common.error'))} onRetry={() => void recent.refetch()} />
              </div>
            )}
            {recent.data && recent.data.items.length === 0 && (
              <EmptyState
                icon={FileText}
                title={t('kb.noRecentArticles')}
                hint={t('article.emptyHint')}
                action={
                  canWrite ? (
                    <Link to={`/kbs/${data.slug}/articles/new`} className="btn-primary">
                      <FileText size={16} />
                      {t('article.create')}
                    </Link>
                  ) : undefined
                }
              />
            )}
            {recent.data && recent.data.items.length > 0 && (
              <ul className="divide-y divide-line">
                {recent.data.items.map((article) => (
                  <li key={article.id}>
                    <Link
                      to={`/kbs/${data.slug}/articles/${article.slug}`}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span dir="auto" className="block truncate text-[14px] font-semibold">
                          {article.title}
                        </span>
                        <span className="meta block truncate">{article.summary ?? ''}</span>
                      </span>
                      <span className="hidden sm:block">
                        <ArticleStatusBadge status={article.status} />
                      </span>
                      <span className="meta hidden w-24 shrink-0 text-end md:block">{formatFaRelative(article.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="space-y-6">
            <section className="surface p-5">
              <h2 className="section-title">{t('kb.rolesTitle')}</h2>
              <p className="meta mt-1">{t('kb.rolesDesc')}</p>
              <ul className="mt-5 space-y-4">
                {KB_ROLES.map((role) => (
                  <li key={role} className="flex flex-col gap-1.5">
                    <Badge tone={roleTone[role] ?? 'neutral'} className="self-start">
                      {roleLabel(role)}
                    </Badge>
                    <p className="text-[13px] leading-6 text-ink-2">{t(`kb.roleDesc_${role}` as I18nKey)}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="surface grid grid-cols-2 divide-x divide-line overflow-hidden">
              <div className="flex flex-col gap-2 p-5">
                <span className="meta flex items-center gap-1.5">
                  <Users size={14} aria-hidden />
                  {t('kb.members')}
                </span>
                <span className="text-[22px] font-bold tabular-nums">{formatFaNumber(data.memberCount)}</span>
              </div>
              <div className="flex flex-col gap-2 p-5">
                <span className="meta flex items-center gap-1.5">
                  <FolderTree size={14} aria-hidden />
                  {t('kb.categories')}
                </span>
                <span className="text-[22px] font-bold tabular-nums">{formatFaNumber(data.categoryCount)}</span>
              </div>
            </section>
          </aside>
        </div>
      )}

      {tab === 'categories' && (
        <section className="surface overflow-hidden">
          <div className="panel-head">
            <FolderTree size={16} className="text-ink-3" aria-hidden />
            <h2 className="section-title">
              {t('kb.categories')} ({formatFaNumber(data.categoryCount)})
            </h2>
          </div>
          <div className="p-5">
            {categories.isPending && <Skeleton className="h-20" />}
            {categories.isError && (
              <InlineError message={toApiMessage(categories.error, t('common.error'))} onRetry={() => void categories.refetch()} />
            )}
            {categories.data && <CategoryTree kbId={data.id} nodes={categories.data} canManage={canManage} />}
          </div>
        </section>
      )}

      {tab === 'members' && (
        <section className="surface overflow-hidden">
          <div className="panel-head">
            <Users size={16} className="text-ink-3" aria-hidden />
            <h2 className="section-title">
              {t('kb.members')} ({formatFaNumber(data.memberCount)})
            </h2>
          </div>

          {canManage && (
            <form onSubmit={(e) => void onInvite(e)} className="flex flex-col gap-3 border-b border-line bg-surface-muted p-4 sm:flex-row sm:items-center">
              <TextInput
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                placeholder={t('kb.memberEmailPh')}
                type="email"
                dir="ltr"
                required
                className="sm:flex-1"
                aria-label={t('auth.email')}
              />
              <Select
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                className="sm:w-40"
                aria-label={t('admin.role')}
              >
                {KB_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`kb.role_${r}` as I18nKey)}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="primary" disabled={addMember.isPending} className="shrink-0">
                <UserPlus size={15} />
                {t('kb.invite')}
              </Button>
            </form>
          )}

          {members.isPending && (
            <div className="space-y-3 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          )}
          {members.isError && (
            <div className="p-5">
              <InlineError message={toApiMessage(members.error, t('common.error'))} onRetry={() => void members.refetch()} />
            </div>
          )}
          {members.data && members.data.length === 0 && <EmptyState icon={Users} title={t('kb.memberListEmpty')} />}
          {members.data && members.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[600px]">
                <thead>
                  <tr>
                    <th>{t('auth.fullName')}</th>
                    <th>{t('auth.email')}</th>
                    <th>{t('admin.role')}</th>
                    {canManage && (
                      <th>
                        <span className="sr-only">{t('common.edit')}</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {members.data.map((m) => (
                    <tr key={m.userId}>
                      <td>
                        <span className="flex items-center gap-3">
                          <Avatar name={m.fullName} size="sm" />
                          <span className="font-semibold">{m.fullName}</span>
                          {m.role === 'manager' && <Crown size={14} className="shrink-0 text-warn" aria-label={t('kb.role_manager')} />}
                        </span>
                      </td>
                      <td dir="ltr" className="text-start font-mono text-[13px] text-ink-3">
                        {m.email}
                      </td>
                      <td>
                        {canManage ? (
                          <Select
                            value={m.role}
                            disabled={updateRole.isPending}
                            onChange={(e) => void onRole(m.userId, e.target.value)}
                            className="h-9 w-36 text-[13px]"
                            aria-label={t('admin.role')}
                          >
                            {KB_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {t(`kb.role_${r}` as I18nKey)}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Badge tone={roleTone[m.role] ?? 'neutral'}>{roleLabel(m.role)}</Badge>
                        )}
                      </td>
                      {canManage && (
                        <td className="text-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn('text-ink-3 hover:text-danger')}
                            disabled={removeMember.isPending}
                            onClick={() => void onRemove(m.userId, m.fullName)}
                          >
                            {t('kb.remove')}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Dialog open={editing} title={t('common.edit')} onClose={() => setEditing(false)}>
        <div className="space-y-5">
          <Field label={t('kb.title')}>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t('kb.description')}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          <Field label={t('kb.visibility')}>
            <Select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="internal">{t('kb.visibilityInternal')}</option>
              <option value="private">{t('kb.visibilityPrivate')}</option>
              <option value="public">{t('kb.visibilityPublic')}</option>
            </Select>
          </Field>
          {updateKb.isError && <p className="form-error">{toApiMessage(updateKb.error, t('common.error'))}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" disabled={updateKb.isPending} onClick={() => void onSave()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={t('kb.delete')}
        body={t('kb.deleteConfirm', { title: data.title })}
        confirmLabel={t('kb.delete')}
        danger
        pending={deleteKb.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
