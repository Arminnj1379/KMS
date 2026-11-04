import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
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

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950';

const KB_ROLES = ['manager', 'contributor', 'reviewer', 'reader'] as const;

export function KbDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const navigate = useNavigate();
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
  const [error, setError] = useState<string | null>(null);

  if (kb.isPending) return <p className="py-16 text-center text-sm text-slate-500">{t('common.loading')}</p>;
  if (kb.isError || !kb.data) {
    return <p className="py-16 text-center text-sm text-red-600">{toApiMessage(kb.error, t('common.error'))}</p>;
  }

  const data = kb.data;
  const canManage = data.role === 'manager' || data.role === 'org-admin';

  function openEdit(): void {
    setTitle(data.title);
    setDescription(data.description ?? '');
    setVisibility(data.visibility);
    setEditing(true);
    setError(null);
  }

  async function onSave(): Promise<void> {
    setError(null);
    try {
      await updateKb.mutateAsync({
        title,
        description: description || undefined,
        visibility: visibility as 'private' | 'internal' | 'public',
      });
      setEditing(false);
    } catch (err) {
      setError(toApiMessage(err, t('common.error')));
    }
  }

  async function onDelete(): Promise<void> {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteKb.mutateAsync();
    navigate('/kbs', { replace: true });
  }

  async function onInvite(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    try {
      await addMember.mutateAsync(invite);
      setInvite({ email: '', role: 'reader' });
    } catch (err) {
      setError(toApiMessage(err, t('common.error')));
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <Link to="/kbs" className="text-sm text-brand-600 underline">
        {t('kb.backToList')}
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        {!editing ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{data.title}</h1>
                <p dir="ltr" className="mt-1 text-left text-xs text-slate-400">
                  {data.slug} · {data.visibility}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={openEdit}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete()}
                    className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 dark:border-red-900"
                  >
                    {confirmDelete ? t('kb.confirmDelete') : t('kb.delete')}
                  </button>
                </div>
              )}
            </div>
            {data.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{data.description}</p>}
          </>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm">
              {t('kb.title')}
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm">
              {t('kb.description')}
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
            </label>
            <label className="block text-sm">
              {t('kb.visibility')}
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={inputClass}>
                <option value="internal">{t('kb.visibilityInternal')}</option>
                <option value="private">{t('kb.visibilityPrivate')}</option>
                <option value="public">{t('kb.visibilityPublic')}</option>
              </select>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void onSave()}
                className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white"
              >
                {t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm dark:border-slate-700"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">
          {t('kb.categories')} ({data.categoryCount})
        </h2>
        <div className="mt-3">
          {categories.isPending && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
          {categories.isError && (
            <p className="text-sm text-red-600">{toApiMessage(categories.error, t('common.error'))}</p>
          )}
          {categories.data && <CategoryTree kbId={data.id} nodes={categories.data} canManage={canManage} />}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">
          {t('kb.members')} ({data.memberCount})
        </h2>
        {members.isPending && <p className="mt-2 text-sm text-slate-500">{t('common.loading')}</p>}
        {members.data && members.data.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <tbody>
              {members.data.map((m) => (
                <tr key={m.userId} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="py-2">{m.fullName}</td>
                  <td dir="ltr" className="py-2 text-left text-slate-500">{m.email}</td>
                  <td className="py-2">
                    {canManage ? (
                      <select
                        value={m.role}
                        disabled={updateRole.isPending}
                        onChange={(e) => void updateRole.mutateAsync({ userId: m.userId, role: e.target.value })}
                        className="rounded border border-slate-300 px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                      >
                        {KB_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs">{m.role}</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="py-2 text-left">
                      <button
                        type="button"
                        disabled={removeMember.isPending}
                        onClick={() => void removeMember.mutateAsync(m.userId)}
                        className="rounded border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700"
                      >
                        {t('kb.remove')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canManage && (
          <form onSubmit={(e) => void onInvite(e)} className="mt-4 flex flex-wrap gap-2">
            <input
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              placeholder={t('auth.email')}
              type="email"
              dir="ltr"
              required
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <select
              value={invite.role}
              onChange={(e) => setInvite({ ...invite, role: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {KB_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={addMember.isPending}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t('kb.invite')}
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
