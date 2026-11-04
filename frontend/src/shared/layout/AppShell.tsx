import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { t } from '../../i18n';
import { cn } from '../../shared/lib/cn';

function navClass(active: boolean): string {
  return cn(
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    active
      ? 'bg-brand-500 text-white'
      : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800',
  );
}

export function AppShell({ children }: { children?: ReactNode }): JSX.Element {
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains('dark'));
  const navigate = useNavigate();

  function toggleTheme(): void {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('kms_theme', next ? 'dark' : 'light');
  }

  function logout(): void {
    localStorage.removeItem('kms_access_token');
    navigate('/login');
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="text-base font-bold text-brand-600">
            {t('app.name')}
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
              {t('nav.dashboard')}
            </NavLink>
            <NavLink to="/kbs" className={({ isActive }) => navClass(isActive)}>
              {t('nav.knowledgeBases')}
            </NavLink>
            <NavLink to="/reviews" className={({ isActive }) => navClass(isActive)}>
              {t('nav.reviews')}
            </NavLink>
            <NavLink to="/search" className={({ isActive }) => navClass(isActive)}>
              {t('nav.search')}
            </NavLink>
            <NavLink to="/admin" className={({ isActive }) => navClass(isActive)}>
              {t('nav.admin')}
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => navClass(isActive)}>
              {t('nav.profile')}
            </NavLink>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={dark ? 'روشن' : 'تیره'}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
            >
              {dark ? '☀️' : '🌙'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children ?? <Outlet />}</main>
    </div>
  );
}
