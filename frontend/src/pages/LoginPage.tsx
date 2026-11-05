import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { Button } from '../shared/ui/Button';
import { Field, TextInput } from '../shared/ui/Field';
import { AuthLayout } from '../features/auth/AuthLayout';
import { useLogin } from '../features/auth/hooks';
import { loginSchema, type LoginInput } from '../features/auth/schemas';

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const mutation = useLogin();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const errors = form.formState.errors;

  async function onSubmit(values: LoginInput): Promise<void> {
    await mutation.mutateAsync(values);
    navigate('/', { replace: true });
  }

  return (
    <AuthLayout
      title={t('auth.login')}
      subtitle={t('auth.formHint')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-accent hover:underline">
            {t('auth.register')}
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-5" noValidate>
        <Field label={t('auth.email')} error={errors.email?.message}>
          <TextInput type="email" dir="ltr" autoComplete="email" autoFocus {...form.register('email')} aria-invalid={!!errors.email} />
        </Field>
        <Field label={t('auth.password')} error={errors.password?.message}>
          <TextInput type="password" dir="ltr" autoComplete="current-password" {...form.register('password')} aria-invalid={!!errors.password} />
        </Field>
        {mutation.isError && (
          <p className="form-error" role="alert">
            {toApiMessage(mutation.error, t('common.error'))}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={mutation.isPending} className="h-11 w-full text-[14.5px]">
          {mutation.isPending ? t('common.loading') : t('auth.submit')}
          {!mutation.isPending && <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />}
        </Button>
      </form>
    </AuthLayout>
  );
}
