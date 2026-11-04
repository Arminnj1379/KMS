import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useRegister } from '../features/auth/hooks';
import { registerSchema, type RegisterInput } from '../features/auth/schemas';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950';

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const mutation = useRegister();
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const errors = form.formState.errors;

  async function onSubmit(values: RegisterInput): Promise<void> {
    await mutation.mutateAsync(values);
    navigate('/', { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-bold">{t('auth.register')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('auth.registerHint')}</p>
        <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="mt-6 space-y-4">
          <label className="block text-sm">
            {t('auth.fullName')}
            <input {...form.register('fullName')} className={inputClass} />
            {errors.fullName && <span className="text-xs text-red-600">{errors.fullName.message}</span>}
          </label>
          <label className="block text-sm">
            {t('auth.email')}
            <input type="email" dir="ltr" {...form.register('email')} className={inputClass} />
            {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
          </label>
          <label className="block text-sm">
            {t('auth.organizationName')}
            <input {...form.register('organizationName')} className={inputClass} />
            {errors.organizationName && (
              <span className="text-xs text-red-600">{errors.organizationName.message}</span>
            )}
          </label>
          <label className="block text-sm">
            {t('auth.password')}
            <input type="password" dir="ltr" {...form.register('password')} className={inputClass} />
            {errors.password && <span className="text-xs text-red-600">{errors.password.message}</span>}
          </label>
          <label className="block text-sm">
            {t('auth.confirmPassword')}
            <input type="password" dir="ltr" {...form.register('confirmPassword')} className={inputClass} />
            {errors.confirmPassword && (
              <span className="text-xs text-red-600">{errors.confirmPassword.message}</span>
            )}
          </label>
          {mutation.isError && (
            <p className="text-sm text-red-600">{toApiMessage(mutation.error, t('common.error'))}</p>
          )}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {mutation.isPending ? t('common.loading') : t('auth.registerSubmit')}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          {t('auth.hasAccount')} <Link to="/login" className="text-brand-600 underline">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  );
}
