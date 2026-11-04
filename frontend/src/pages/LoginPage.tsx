import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../i18n';

/** Phase 1 placeholder — wired to real auth in Phase 2. Disabled with reason (no dead buttons). */
export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    // Phase 2 implements POST /auth/login; for now persist nothing and stay put.
    if (email && password) navigate('/');
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-bold">{t('auth.login')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('auth.welcome')}</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            {t('auth.email')}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="block text-sm">
            {t('auth.password')}
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <button
            type="submit"
            disabled
            title="ورود واقعی در فاز ۲ فعال می‌شود"
            className="w-full cursor-not-allowed rounded-lg bg-brand-500/50 px-3 py-2 text-sm font-semibold text-white"
          >
            {t('auth.submit')} (فاز ۲)
          </button>
        </form>
      </div>
    </div>
  );
}
