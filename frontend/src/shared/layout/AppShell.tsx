import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { X } from 'lucide-react';
import { t } from '../../i18n';
import { HeaderCrumbsProvider } from '../ui/header-crumbs';
import { cn } from '../lib/cn';
import { AppHeader } from './Header';
import { Sidebar } from './Sidebar';

const SIDEBAR_KEY = 'kms_sidebar';

export function AppShell(): JSX.Element {
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(SIDEBAR_KEY) === 'slim');
  const [drawer, setDrawer] = useState(false);

  function toggleCollapsed(): void {
    setCollapsed((value) => {
      localStorage.setItem(SIDEBAR_KEY, value ? 'full' : 'slim');
      return !value;
    });
  }

  return (
    <HeaderCrumbsProvider>
      <div className="min-h-screen">
        <aside
          className={cn(
            'fixed inset-y-0 start-0 z-30 hidden flex-col border-e border-line bg-surface transition-[width] duration-200 lg:flex',
            collapsed ? 'w-16' : 'w-[248px]',
          )}
        >
          <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t('app.name')}>
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={() => setDrawer(false)}
              className="absolute inset-0 animate-fade-in cursor-default bg-overlay/40"
            />
            <aside className="absolute inset-y-0 start-0 w-[272px] animate-rise-in border-e border-line bg-surface shadow-pop">
              <button type="button" onClick={() => setDrawer(false)} className="btn-icon-sm absolute end-3 top-4 z-10" aria-label={t('common.close')}>
                <X size={17} />
              </button>
              <Sidebar collapsed={false} onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        )}

        <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:ps-16' : 'lg:ps-[248px]')}>
          <AppHeader onOpenMenu={() => setDrawer(true)} />
          <main className="px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto w-full max-w-[1180px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </HeaderCrumbsProvider>
  );
}
