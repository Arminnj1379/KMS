import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Crown, FolderTree, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { ConfirmDialog, Dialog } from '../shared/ui/Dialog';
import { Field, Select, Textarea, TextInput } from '../shared/ui/Field';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { Badge } from '../shared/ui/Badge';
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
import { formatFaNumber } from '../shared/lib/format-fa';

const KB_ROLES = ['manager', 'contributor', 'reviewer', 'reader'] as const;

const roleTone = { manager: 'blue', contributor: 'green', reviewer: 'amber', reader: 'slate' } as const;

export function KbDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const kb = useKb(id);
  const members = useKbMembers(id);
  const categories = useCategories(id);
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

  const canManage = kb.data?.role === 'manager' || kb.data?.role === 'org-admin';

  if (kb.isPending) {
    return (
      <section className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-64" />
        <div className="surface p-5"><Skeleton className="h-24" /></div>
      </section>
    );
  }
  if (kb.isError || !kb.data) {
    return (
      <section className="mx-auto max-w-4xl">
        <InlineError message={toApiMessage(kb.error, t('common.error'))} onRetry={() => void kb.refetch()} />
      </section>
    );
  }

  const data = kb.data;

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
      toast.success(t('kb.memberRemovedToast', { name: fullName } as never));
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={data.title}
        description={data.description ?? undefined}
        breadcrumbs={[{ label: t('nav.knowledgeBases'), to: '/kbs' }, { label: data.title }]}
        actions={
          canManage ? (
            <>
              <Button variant="ghost" size="sm" onClick={openEdit}>
                <Pencil size={15} />
                {t('common.edit')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} />
                {t('kb.delete')}
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="surface flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5">
        <span className="meta flex items-center gap-1.5">
          <Users size={14} />
          {t('kb.members')}: {formatFaNumber(data.memberCount)}
        </span>
        <span className="meta flex items-center gap-1.5">
          <FolderTree size={14} />
          {t('kb.categories')}: {formatFaNumber(data.categoryCount)}
        </span>
        <span className="meta" dir="ltr">{data.slug}</span>
        <Link to={`/kbs/${data.slug}/articles`} className="btn-primary btn-sm ms-auto">
          {t('article.listTitle')}
        </Link>
      </div>

      <Dialog open={editing} title={t('common.edit')} onClose={() => setEditing(false)}>
        <div className="space-y-4">
          <Field label={t('kb.title')}>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t('kb.description')}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label={t('kb.visibility')}>
            <Select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="internal">{t('kb.visibilityInternal')}</option>
              <option value="private">{t('kb.visibilityPrivate')}</option>
              <option value="public">{t('kb.visibilityPublic')}</option>
            </Select>
          </Field>
          {updateKb.isError && <p className="form-error">{toApiMessage(updateKb.error, t('common.error'))}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" disabled={updateKb.isPending} onClick={() => void onSave()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={t('kb.delete')}
        body={t('kb.deleteConfirm', { title: data.title } as never)}
        confirmLabel={t('kb.delete')}
        danger
        pending={deleteKb.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void onDelete()}
      />

      <div className="surface overflow-hidden">
        <div className="hairline-b flex items-center gap-2 px-5 py-3.5">
          <FolderTree size={16} className="text-slate-400" />
          <h2 className="section-title">
            {t('kb.categories')} · {formatFaNumber(data.categoryCount)}
          </h2>
        </div>
        <div className="p-5">
          {categories.isPending && <Skeleton className="h-20" />}
          {categories.isError && <InlineError message={toApiMessage(categories.error, t('common.error'))} onRetry={() => void categories.refetch()} />}
          {categories.data && categories.data.length === 0 && (
            <p className="meta">{t('kb.noCategories')}</p>
          )}
          {categories.data && <CategoryTree kbId={data.id} nodes={categories.data} canManage={canManage} />}
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="hairline-b flex items-center gap-2 px-5 py-3.5">
          <Users size={16} className="text-slate-400" />
          <h2 className="section-title">
            {t('kb.members')} · {formatFaNumber(data.memberCount)}
          </h2>
        </div>
        {members.isPending && (
          <div className="space-y-2.5 p-5">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        )}
        {members.isError && (
          <div className="p-5">
            <InlineError message={toApiMessage(members.error, t('common.error'))} onRetry={() => void members.refetch()} />
          </div>
        )}
        {members.data && members.data.length > 0 && (
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('auth.fullName')}</th>
                <th>{t('auth.email')}</th>
                <th>{t('admin.role')}</th>
                {canManage && <th><span className="sr-only">actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {members.data.map((m) => (
                <tr key={m.userId}>
                  <td>
                    <span className="flex items-center gap-2">
                      {m.role === 'manager' && <Crown size={14} className="shrink-0 text-amber-500" aria-label="manager" />}
                      <span className="font-medium">{m.fullName}</span>
                    </span>
                  </td>
                  <td dir="ltr" className="text-left text-slate-500 dark:text-slate-400">{m.email}</td>
                  <td>
                    {canManage ? (
                      <Select
                        value={m.role}
                        disabled={updateRole.isPending}
                        onChange={(e) => void onRole(m.userId, e.target.value)}
                        className="h-8 w-auto py-1 text-xs"
                        aria-label={t('admin.role')}
                      >
                        {KB_ROLES.map((r) => (
                          <option key={r} value={r}>{t(`kb.role_${r}` as never)}</option>
                        ))}
                      </Select>
                    ) : (
                      <Badge tone={roleTone[m.role as keyof typeof roleTone] ?? 'slate'}>{t(`kb.role_${m.role}` as never)}</Badge>
                    )}
                  </td>
                  {canManage && (
                    <td className="text-end">
                      <Button variant="ghost" size="sm" disabled={removeMember.isPending} onClick={() => void onRemove(m.userId, m.fullName)}>
                        {t('kb.remove')}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canManage && (
          <form onSubmit={(e) => void onInvite(e)} className="flex flex-wrap gap-2 border-t p-4" style={{ borderColor: 'var(--line)' }}>
            <TextInput
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              placeholder={t('auth.email')}
              type="email"
              dir="ltr"
              required
              className="min-w-0 flex-1"
              aria-label={t('auth.email')}
            />
            <Select
              value={invite.role}
              onChange={(e) => setInvite({ ...invite, role: e.target.value })}
              className="w-auto"
              aria-label={t('admin.role')}
            >
              {KB_ROLES.map((r) => (
                <option key={r} value={r}>{t(`kb.role_${r}` as never)}</option>
              ))}
            </Select>
            <Button type="submit" variant="primary" disabled={addMember.isPending}>
              <UserPlus size={15} />
              {t('kb.invite')}
            </Button>
          </form>
        )}
      </div>

      {members.data && members.data.length === 0 && !members.isPending && (
        <EmptyState icon={Users} title={t('common.empty')} />
      )}
    </section>
  );
}
