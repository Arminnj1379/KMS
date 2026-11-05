import { useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useInviteUser, useMe, useUpdateUser, useUsers } from '../features/auth/hooks';

export function AdminPage(): JSX.Element {
  const me = useMe();
  const [search, setSearch] = useState('');
  const users = useUsers(search);
  const invite = useInviteUser();
  const update = useUpdateUser();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'member' as 'org-admin' | 'member' });

  const isAdmin = me.data?.memberships.some((m) => m.role === 'org-admin') ?? false;

  async function onInvite(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    await invite.mutateAsync(form);
    setForm({ fullName: '', email: '', password: '', role: 'member' });
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">{t('admin.title')}</h1>

      {!me.isPending && !isAdmin && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t('admin.forbidden')}
        </div>
      )}

      {isAdmin && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t('activity.title')}</h2>
              <Link to="/activity" className="text-sm font-medium text-brand-600 hover:underline">
                {t('activity.title')} ←
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold">{t('admin.invite')}</h2>
            <form onSubmit={(e) => void onInvite(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder={t('auth.fullName')}
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t('auth.email')}
                type="email"
                dir="ltr"
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={t('auth.password')}
                type="password"
                dir="ltr"
                required
                minLength={8}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as 'org-admin' | 'member' })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="member">{t('roles.member')}</option>
                <option value="org-admin">{t('roles.orgAdmin')}</option>
              </select>
              <div className="sm:col-span-2">
                {invite.isError && (
                  <p className="mb-2 text-sm text-red-600">{toApiMessage(invite.error, t('common.error'))}</p>
                )}
                <button
                  type="submit"
                  disabled={invite.isPending}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {t('admin.inviteSubmit')}
                </button>
              </div>
            </form>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin.search')}
                className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            {users.isPending && <p className="p-6 text-sm text-slate-500">{t('common.loading')}</p>}
            {users.isError && (
              <p className="p-6 text-sm text-red-600">{toApiMessage(users.error, t('common.error'))}</p>
            )}
            {users.data && users.data.data.length === 0 && (
              <p className="p-6 text-sm text-slate-500">{t('common.empty')}</p>
            )}
            {users.data && users.data.data.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                    <th className="px-4 py-2 text-right font-medium">{t('auth.fullName')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('auth.email')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('admin.role')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('admin.status')}</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {users.data.data.map((row) => (
                    <tr key={row.user.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-4 py-2">{row.user.fullName}</td>
                      <td dir="ltr" className="px-4 py-2 text-left">{row.user.email}</td>
                      <td className="px-4 py-2">
                        {row.role === 'org-admin' ? t('roles.orgAdmin') : t('roles.member')}
                      </td>
                      <td className="px-4 py-2">
                        {row.user.isActive ? t('admin.active') : t('admin.inactive')}
                      </td>
                      <td className="px-4 py-2 text-left">
                        <button
                          type="button"
                          disabled={update.isPending}
                          onClick={() =>
                            void update.mutateAsync({
                              id: row.user.id,
                              input: { isActive: !row.user.isActive },
                            })
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                        >
                          {row.user.isActive ? t('admin.deactivate') : t('admin.activate')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}
