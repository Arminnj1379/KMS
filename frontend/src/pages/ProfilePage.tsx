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
import { InlineError, Skeleton } from '../shared/ui/Feedback';
import { useChangePassword, useLogout, useMe } from '../features/auth/hooks';
import { changePasswordSchema, type ChangePasswordInput } from '../features/auth/schemas';

export function ProfilePage(): JSX.Element {
  const me = useMe();
  const logout = useLogout();
  const password = useChangePassword();
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });
  const errors = form.formState.errors;

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
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="surface p-5">
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }
  if (me.isError || !me.data) {
    return <InlineError message={toApiMessage(me.error, t('common.error'))} onRetry={() => void me.refetch()} />;
  }

  const { user, memberships } = me.data;

  return (
    <div className="space-y-8">
      <PageHeader title={t('profile.title')} description={t('profile.desc')} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="space-y-6">
          <section className="surface p-5" aria-label={t('profile.account')}>
            <div className="flex items-center gap-4">
              <Avatar name={user.fullName} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-bold">{user.fullName}</p>
                <p dir="ltr" className="truncate text-start text-[13px] text-ink-3">
                  {user.email}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void onLogout()} className="mt-5 w-full">
              <LogOut size={15} />
              {t('auth.logout')}
            </Button>
          </section>

          <section className="surface overflow-hidden">
            <div className="panel-head">
              <Building2 size={16} className="text-ink-3" aria-hidden />
              <h2 className="section-title">{t('profile.memberships')}</h2>
            </div>
            <p className="meta px-5 pt-3">{t('profile.membershipsDesc')}</p>
            <ul className="divide-y divide-line pt-1">
              {memberships.map((m) => (
                <li key={m.organization.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{m.organization.name}</p>
                    {m.department && <p className="meta truncate text-[12.5px]">{m.department.name}</p>}
                  </div>
                  <Badge tone={m.role === 'org-admin' ? 'accent' : 'neutral'}>
                    {m.role === 'org-admin' ? t('roles.orgAdmin') : t('roles.member')}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="surface overflow-hidden self-start">
          <div className="panel-head">
            <KeyRound size={16} className="text-ink-3" aria-hidden />
            <h2 className="section-title">{t('profile.security')}</h2>
          </div>
          <form onSubmit={(e) => void form.handleSubmit(onPassword)(e)} className="space-y-5 p-5" noValidate>
            <p className="meta -mt-1">{t('profile.securityDesc')}</p>
            <Field label={t('profile.currentPassword')} error={errors.currentPassword?.message}>
              <TextInput
                type="password"
                dir="ltr"
                autoComplete="current-password"
                {...form.register('currentPassword')}
                aria-invalid={!!errors.currentPassword}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('profile.newPassword')} error={errors.newPassword?.message}>
                <TextInput
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  {...form.register('newPassword')}
                  aria-invalid={!!errors.newPassword}
                />
              </Field>
              <Field label={t('auth.confirmPassword')} error={errors.confirmPassword?.message}>
                <TextInput
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  {...form.register('confirmPassword')}
                  aria-invalid={!!errors.confirmPassword}
                />
              </Field>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" variant="primary" disabled={password.isPending}>
                {t('profile.changePassword')}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
