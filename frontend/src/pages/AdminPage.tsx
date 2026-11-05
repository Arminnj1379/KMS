import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { Dialog } from '../shared/ui/Dialog';
import { Field, Select, TextInput } from '../shared/ui/Field';
import { Badge } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { Avatar } from '../shared/ui/Chrome';
import { useInviteUser, useMe, useUpdateUser, useUsers } from '../features/auth/hooks';
import { formatFaDate } from '../shared/lib/format-fa';

export function AdminPage(): JSX.Element {
  const me = useMe();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const users = useUsers(search);
  const invite = useInviteUser();
  const update = useUpdateUser();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'member' as 'org-admin' | 'member' });

  const isAdmin = me.data?.memberships.some((m) => m.role === 'org-admin') ?? false;

  async function onInvite(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    try {
      await invite.mutateAsync(form);
      toast.success(t('admin.invitedToast'));
      setForm({ fullName: '', email: '', password: '', role: 'member' });
      setInviteOpen(false);
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  async function onToggleActive(id: string, next: boolean): Promise<void> {
    try {
      await update.mutateAsync({ id, input: { isActive: next } });
      toast.success(t('common.savedToast'));
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title={t('admin.title')}
        description={t('admin.desc')}
        actions={
          isAdmin ? (
            <>
              <Link to="/activity" className="btn-secondary btn-sm">
                <Activity size={15} />
                {t('activity.title')}
              </Link>
              <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus size={15} />
                {t('admin.invite')}
              </Button>
            </>
          ) : undefined
        }
      />

      {!me.isPending && !isAdmin && (
        <div className="surface flex items-center gap-2.5 border-amber-300 bg-amber-50/60 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <ShieldCheck size={17} className="shrink-0" />
          {t('admin.forbidden')}
        </div>
      )}

      {isAdmin && (
        <div className="surface overflow-hidden">
          <div className="hairline-b p-4">
            <div className="relative max-w-xs">
              <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <TextInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin.search')}
                aria-label={t('admin.search')}
                className="ps-9"
              />
            </div>
          </div>
          {users.isPending && (
            <div className="space-y-2.5 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          )}
          {users.isError && (
            <div className="p-5">
              <InlineError message={toApiMessage(users.error, t('common.error'))} onRetry={() => void users.refetch()} />
            </div>
          )}
          {users.data && users.data.data.length === 0 && (
            <EmptyState icon={Search} title={t('common.empty')} />
          )}
          {users.data && users.data.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[640px]">
                <thead>
                  <tr>
                    <th>{t('auth.fullName')}</th>
                    <th>{t('auth.email')}</th>
                    <th>{t('admin.role')}</th>
                    <th>{t('admin.status')}</th>
                    <th>{t('admin.memberSince')}</th>
                    <th><span className="sr-only">actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.data.map((row) => (
                    <tr key={row.user.id}>
                      <td>
                        <span className="flex items-center gap-2.5">
                          <Avatar name={row.user.fullName} size="sm" />
                          <span className="font-medium">{row.user.fullName}</span>
                        </span>
                      </td>
                      <td dir="ltr" className="text-left text-slate-500 dark:text-slate-400">{row.user.email}</td>
                      <td>
                        <Badge tone={row.role === 'org-admin' ? 'blue' : 'slate'} dot={false}>
                          {row.role === 'org-admin' ? t('roles.orgAdmin') : t('roles.member')}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={row.user.isActive ? 'green' : 'slate'}>
                          {row.user.isActive ? t('admin.active') : t('admin.inactive')}
                        </Badge>
                      </td>
                      <td className="meta whitespace-nowrap">{formatFaDate(row.memberSince)}</td>
                      <td className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={update.isPending}
                          onClick={() => void onToggleActive(row.user.id, !row.user.isActive)}
                        >
                          {row.user.isActive ? t('admin.deactivate') : t('admin.activate')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Dialog open={inviteOpen} title={t('admin.invite')} description={t('admin.inviteDesc')} onClose={() => setInviteOpen(false)}>
        <form onSubmit={(e) => void onInvite(e)} className="space-y-4" noValidate>
          <Field label={t('auth.fullName')}>
            <TextInput value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required autoComplete="name" />
          </Field>
          <Field label={t('auth.email')}>
            <TextInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" dir="ltr" required autoComplete="email" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('auth.password')}>
              <TextInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" dir="ltr" required minLength={8} autoComplete="new-password" />
            </Field>
            <Field label={t('admin.role')}>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'org-admin' | 'member' })}>
                <option value="member">{t('roles.member')}</option>
                <option value="org-admin">{t('roles.orgAdmin')}</option>
              </Select>
            </Field>
          </div>
          {invite.isError && <p className="form-error">{toApiMessage(invite.error, t('common.error'))}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={invite.isPending}>
              {t('admin.inviteSubmit')}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
