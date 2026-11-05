import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Building2, KeyRound, LogOut } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useToast } from '../shared/ui/Toast';
import { Avatar, PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { Field, TextInput } from '../shared/ui/Field';
import { Badge } from '../shared/ui/Badge';
import { Skeleton } from '../shared/ui/Feedback';
import { useChangePassword, useLogout, useMe } from '../features/auth/hooks';
import { changePasswordSchema, type ChangePasswordInput } from '../features/auth/schemas';

export function ProfilePage(): JSX.Element {
  const me = useMe();
  const logout = useLogout();
  const password = useChangePassword();
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onPassword(values: ChangePasswordInput): Promise<void> {
    try {
      await password.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      toast.success(t('profile.reloginNotice'));
      form.reset();
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  async function onLogout(): Promise<void> {
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  }

  if (me.isPending) {
    return (
      <section className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="surface p-5"><Skeleton className="h-20" /></div>
      </section>
    );
  }
  if (me.isError || !me.data) {
    return <p className="mx-auto max-w-2xl py-16 text-center text-sm text-rose-600">{t('common.error')}</p>;
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={t('profile.title')} />

      <div className="surface flex flex-wrap items-center gap-4 p-5">
        <Avatar name={me.data.user.fullName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{me.data.user.fullName}</p>
          <p dir="ltr" className="truncate text-left text-[13px] text-slate-500 dark:text-slate-400">{me.data.user.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void onLogout()} className="ms-auto">
          <LogOut size={15} />
          {t('auth.logout')}
        </Button>
      </div>

      <div className="surface overflow-hidden">
        <div className="hairline-b flex items-center gap-2 px-5 py-3.5">
          <Building2 size={16} className="text-slate-400" />
          <h2 className="section-title">{t('profile.memberships')}</h2>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {me.data.memberships.map((m) => (
            <li key={m.organization.id} className="flex items-center gap-2 px-5 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{m.organization.name}</span>
              <Badge tone={m.role === 'org-admin' ? 'blue' : 'slate'} dot={false}>
                {m.role === 'org-admin' ? t('roles.orgAdmin') : t('roles.member')}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <div className="surface overflow-hidden">
        <div className="hairline-b flex items-center gap-2 px-5 py-3.5">
          <KeyRound size={16} className="text-slate-400" />
          <h2 className="section-title">{t('profile.changePassword')}</h2>
        </div>
        <form onSubmit={(e) => void form.handleSubmit(onPassword)(e)} className="space-y-4 p-5" noValidate>
          <Field label={t('profile.currentPassword')} error={form.formState.errors.currentPassword?.message}>
            <TextInput type="password" dir="ltr" autoComplete="current-password" {...form.register('currentPassword')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('profile.newPassword')} error={form.formState.errors.newPassword?.message}>
              <TextInput type="password" dir="ltr" autoComplete="new-password" {...form.register('newPassword')} />
            </Field>
            <Field label={t('auth.confirmPassword')} error={form.formState.errors.confirmPassword?.message}>
              <TextInput type="password" dir="ltr" autoComplete="new-password" {...form.register('confirmPassword')} />
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={password.isPending}>
            {t('common.save')}
          </Button>
        </form>
      </div>
    </section>
  );
}
