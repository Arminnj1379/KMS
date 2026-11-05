import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { Button } from '../shared/ui/Button';
import { Field, TextInput } from '../shared/ui/Field';
import { AuthLayout } from '../features/auth/AuthLayout';
import { useRegister } from '../features/auth/hooks';
import { registerSchema, type RegisterInput } from '../features/auth/schemas';

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
    <AuthLayout
      title={t('auth.register')}
      subtitle={t('auth.registerHint')}
      footer={
        <>
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            {t('auth.login')}
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-5" noValidate>
        <Field label={t('auth.fullName')} error={errors.fullName?.message}>
          <TextInput autoComplete="name" {...form.register('fullName')} aria-invalid={!!errors.fullName} />
        </Field>
        <Field label={t('auth.email')} error={errors.email?.message}>
          <TextInput type="email" dir="ltr" autoComplete="email" {...form.register('email')} aria-invalid={!!errors.email} />
        </Field>
        <Field label={t('auth.organizationName')} error={errors.organizationName?.message}>
          <TextInput autoComplete="organization" {...form.register('organizationName')} aria-invalid={!!errors.organizationName} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('auth.password')} error={errors.password?.message}>
            <TextInput type="password" dir="ltr" autoComplete="new-password" {...form.register('password')} aria-invalid={!!errors.password} />
          </Field>
          <Field label={t('auth.confirmPassword')} error={errors.confirmPassword?.message}>
            <TextInput type="password" dir="ltr" autoComplete="new-password" {...form.register('confirmPassword')} aria-invalid={!!errors.confirmPassword} />
          </Field>
        </div>
        {mutation.isError && (
          <p className="form-error" role="alert">
            {toApiMessage(mutation.error, t('common.error'))}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={mutation.isPending} className="h-11 w-full text-[14.5px]">
          {mutation.isPending ? t('common.loading') : t('auth.registerSubmit')}
          {!mutation.isPending && <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />}
        </Button>
      </form>
    </AuthLayout>
  );
}
