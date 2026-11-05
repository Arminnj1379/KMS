import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { formatFaDay, formatFaNumber } from '../shared/lib/format-fa';
import { useToast } from '../shared/ui/Toast';
import { Avatar, PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { Dialog, DialogFooter } from '../shared/ui/Dialog';
import { Field, Select, TextInput } from '../shared/ui/Field';
import { Badge } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { useInviteUser, useMe, useUpdateUser, useUsers } from '../features/auth/hooks';

export function AdminPage(): JSX.Element {
  const me = useMe();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const isAdmin = me.data?.memberships.some((m) => m.role === 'org-admin') ?? false;
  const users = useUsers(search, isAdmin);
  const invite = useInviteUser();
  const update = useUpdateUser();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'member' as 'org-admin' | 'member' });

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

  const rows = users.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.title')}
        description={t('admin.desc')}
        actions={
          isAdmin ? (
            <>
              <Link to="/activity" className="btn-secondary">
                <Activity size={16} />
                {t('activity.title')}
              </Link>
              <Button variant="primary" onClick={() => setInviteOpen(true)}>
                <UserPlus size={16} />
                {t('admin.invite')}
              </Button>
            </>
          ) : undefined
        }
      />

      {!me.isPending && !isAdmin && (
        <div className="surface flex items-center gap-3 p-5 text-[14px] text-ink-2">
          <ShieldCheck size={18} className="shrink-0 text-warn" aria-hidden />
          {t('admin.forbidden')}
        </div>
      )}

      {isAdmin && (
        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
            <div className="relative w-full sm:w-72">
              <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-4" aria-hidden />
              <TextInput
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin.search')}
                aria-label={t('admin.search')}
                className="ps-9"
              />
            </div>
            {users.data && <span className="meta tabular-nums">{t('admin.count', { count: formatFaNumber(users.data.total) })}</span>}
          </div>

          {users.isPending && (
            <div className="space-y-3 p-5">
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
          {users.data && rows.length === 0 && (
            <EmptyState icon={Search} title={search ? t('admin.noMatch') : t('common.empty')} />
          )}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[680px]">
                <thead>
                  <tr>
                    <th>{t('auth.fullName')}</th>
                    <th>{t('auth.email')}</th>
                    <th>{t('admin.role')}</th>
                    <th>{t('admin.status')}</th>
                    <th>{t('admin.memberSince')}</th>
                    <th>
                      <span className="sr-only">{t('admin.colActions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.user.id}>
                      <td>
                        <span className="flex items-center gap-3">
                          <Avatar name={row.user.fullName} size="sm" />
                          <span className="font-semibold">{row.user.fullName}</span>
                        </span>
                      </td>
                      <td dir="ltr" className="whitespace-nowrap text-start font-mono text-[13px] text-ink-3">
                        {row.user.email}
                      </td>
                      <td>
                        <Badge tone={row.role === 'org-admin' ? 'accent' : 'neutral'}>
                          {row.role === 'org-admin' ? t('roles.orgAdmin') : t('roles.member')}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={row.user.isActive ? 'success' : 'outline'} dot>
                          {row.user.isActive ? t('admin.active') : t('admin.inactive')}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap text-ink-3">{formatFaDay(row.memberSince)}</td>
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
        </section>
      )}

      <Dialog open={inviteOpen} title={t('admin.invite')} description={t('admin.inviteDesc')} onClose={() => setInviteOpen(false)}>
        <form onSubmit={(e) => void onInvite(e)} className="space-y-5" noValidate>
          <Field label={t('auth.fullName')}>
            <TextInput value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required autoComplete="name" />
          </Field>
          <Field label={t('auth.email')}>
            <TextInput
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              type="email"
              dir="ltr"
              required
              autoComplete="email"
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('auth.password')}>
              <TextInput
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                type="password"
                dir="ltr"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
            <Field label={t('admin.role')}>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'org-admin' | 'member' })}>
                <option value="member">{t('roles.member')}</option>
                <option value="org-admin">{t('roles.orgAdmin')}</option>
              </Select>
            </Field>
          </div>
          {invite.isError && <p className="form-error">{toApiMessage(invite.error, t('common.error'))}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={invite.isPending}>
              {t('admin.inviteSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
