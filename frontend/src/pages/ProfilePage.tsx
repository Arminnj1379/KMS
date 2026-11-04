import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useChangePassword, useLogout, useMe } from '../features/auth/hooks';
import { changePasswordSchema, type ChangePasswordInput } from '../features/auth/schemas';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950';

export function ProfilePage(): JSX.Element {
  const me = useMe();
  const logout = useLogout();
  const password = useChangePassword();
  const navigate = useNavigate();
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onPassword(values: ChangePasswordInput): Promise<void> {
    await password.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword });
    form.reset();
  }

  async function onLogout(): Promise<void> {
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  }

  if (me.isPending) return <p className="py-16 text-center text-sm text-slate-500">{t('common.loading')}</p>;
  if (me.isError || !me.data) {
    return <p className="py-16 text-center text-sm text-red-600">{t('common.error')}</p>;
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t('profile.title')}</h1>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold">{me.data.user.fullName}</p>
        <p dir="ltr" className="mt-1 text-left text-sm text-slate-500">{me.data.user.email}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {me.data.memberships.map((m) => (
            <span
              key={m.organization.id}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800"
            >
              {m.organization.name} · {m.role === 'org-admin' ? t('roles.orgAdmin') : t('roles.member')}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="mt-4 rounded-lg border border-slate-300 px-4 py-1.5 text-sm dark:border-slate-700"
        >
          {t('auth.logout')}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">{t('profile.changePassword')}</h2>
        <form onSubmit={(e) => void form.handleSubmit(onPassword)(e)} className="mt-4 space-y-4">
          <label className="block text-sm">
            {t('profile.currentPassword')}
            <input type="password" dir="ltr" {...form.register('currentPassword')} className={inputClass} />
          </label>
          <label className="block text-sm">
            {t('profile.newPassword')}
            <input type="password" dir="ltr" {...form.register('newPassword')} className={inputClass} />
            {form.formState.errors.newPassword && (
              <span className="text-xs text-red-600">{form.formState.errors.newPassword.message}</span>
            )}
          </label>
          <label className="block text-sm">
            {t('auth.confirmPassword')}
            <input type="password" dir="ltr" {...form.register('confirmPassword')} className={inputClass} />
            {form.formState.errors.confirmPassword && (
              <span className="text-xs text-red-600">{form.formState.errors.confirmPassword.message}</span>
            )}
          </label>
          {password.isError && (
            <p className="text-sm text-red-600">{toApiMessage(password.error, t('common.error'))}</p>
          )}
          {password.isSuccess && <p className="text-sm text-emerald-600">{t('profile.reloginNotice')}</p>}
          <button
            type="submit"
            disabled={password.isPending}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {t('common.save')}
          </button>
        </form>
      </div>
    </section>
  );
}
