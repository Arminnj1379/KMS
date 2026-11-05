import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  BookOpenText,
  Building2,
  ChevronsRight,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  Users,
} from 'lucide-react';
import { t } from '../../i18n';
import { useMe } from '../../features/auth/hooks';
import { logout } from '../../features/auth/api';
import { useUnreadCount } from '../../features/notifications/hooks';
import { Avatar } from '../ui/Chrome';
import { cn } from '../lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

const groups: { titleKey: string; items: NavItem[] }[] = [
  {
    titleKey: 'nav.groups.knowledge',
    items: [
      { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
      { to: '/kbs', label: 'nav.knowledgeBases', icon: BookOpenText },
      { to: '/search', label: 'nav.search', icon: Search },
      { to: '/reviews', label: 'nav.reviews', icon: ClipboardCheck },
    ],
  },
  {
    titleKey: 'nav.groups.personal',
    items: [{ to: '/notifications', label: 'nav.notifications', icon: Bell }],
  },
  {
    titleKey: 'nav.groups.admin',
    items: [
      { to: '/admin', label: 'nav.admin', icon: Users },
      { to: '/activity', label: 'nav.activity', icon: Activity },
    ],
  },
];

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }): JSX.Element {
  const me = useMe();
  const { data: unread } = useUnreadCount();
  const user = me.data?.user ?? null;
  const orgName = me.data?.memberships[0]?.organization.name ?? null;

  return (
    <div className="flex h-full flex-col">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5 px-4 pt-5" aria-label={t('app.name')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-600 text-lg font-bold text-white">
          د
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold leading-6">{t('app.name')}</span>
            {orgName && (
              <span className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                <Building2 size={12} className="shrink-0" />
                <span className="truncate">{orgName}</span>
              </span>
            )}
          </span>
        )}
      </Link>

      <nav className="mt-5 flex-1 space-y-5 overflow-y-auto px-2.5 pb-4" aria-label="primary">
        {groups.map((group) => (
          <div key={group.titleKey}>
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">{t(group.titleKey as never)}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const badge = item.to === '/notifications' ? (unread?.unread ?? 0) : 0;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onNavigate}
                      title={collapsed ? t(item.label as never) : undefined}
                      className={({ isActive }) => cn('navlink', isActive && 'navlink-active', collapsed && 'justify-center px-0')}
                    >
                      <span className="relative shrink-0">
                        <Icon size={18} strokeWidth={1.9} />
                        {badge > 0 && (
                          <span className="absolute -left-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold leading-4 text-white">
                            {badge > 99 ? '۹۹+' : badge}
                          </span>
                        )}
                      </span>
                      {!collapsed && <span className="truncate">{t(item.label as never)}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t px-2.5 py-3" style={{ borderColor: 'var(--line)' }}>
        {user ? (
          <div className={cn('flex items-center gap-2.5 rounded-control px-2 py-1.5', collapsed && 'justify-center px-0')}>
            <Link to="/profile" onClick={onNavigate} aria-label={t('nav.profile')}>
              <Avatar name={user.fullName} />
            </Link>
            {!collapsed && (
              <>
                <Link to="/profile" onClick={onNavigate} className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{user.fullName}</span>
                  <span dir="ltr" className="block truncate text-left text-[11px] text-slate-400">
                    {user.email}
                  </span>
                </Link>
                <LogoutButton />
              </>
            )}
          </div>
        ) : (
          !collapsed && <div className="skeleton mx-2 h-9" />
        )}
      </div>
    </div>
  );
}

function LogoutButton(): JSX.Element {
  const navigate = useNavigate();
  async function onLogout(): Promise<void> {
    await logout();
    navigate('/login', { replace: true });
  }
  return (
    <button type="button" onClick={() => void onLogout()} className="btn-icon-sm" title={t('auth.logout')} aria-label={t('auth.logout')}>
      <LogOut size={16} />
    </button>
  );
}

function ThemeToggle(): JSX.Element {
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains('dark'));
  function toggle(): void {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('kms_theme', next ? 'dark' : 'light');
  }
  return (
    <button type="button" onClick={toggle} className="btn-icon" aria-label={dark ? 'روشن' : 'تیره'} title={dark ? 'روشن' : 'تیره'}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function HeaderSearch(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [value, setValue] = useState('');
  if (location.pathname === '/search') return <span className="hidden sm:block" />;
  return (
    <form
      className="relative hidden min-w-0 flex-1 max-w-md sm:block"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(value.trim())}`);
      }}
      role="search"
    >
      <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('nav.search')}
        className="input h-9 py-1.5 pe-3 ps-9"
      />
    </form>
  );
}

export function AppShell({ children }: { children?: ReactNode }): JSX.Element {
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem('kms_sidebar') === 'slim');
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();

  function toggleCollapsed(): void {
    setCollapsed((v) => {
      localStorage.setItem('kms_sidebar', v ? 'full' : 'slim');
      return !v;
    });
  }

  return (
    <div className="min-h-screen">
      {/* desktop sidebar (start side = right in RTL) */}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-30 hidden border-e bg-white transition-all duration-200 lg:block dark:bg-slate-900',
          collapsed ? 'w-[76px]' : 'w-[264px]',
        )}
        style={{ borderColor: 'var(--line)' }}
        aria-hidden={false}
      >
        <SidebarContent collapsed={collapsed} />
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'}
          className="btn-icon-sm absolute -end-3.5 top-7 border bg-white shadow-lift dark:bg-slate-900"
          style={{ borderColor: 'var(--line)' }}
        >
          <ChevronsRight size={15} className={cn('transition-transform duration-200 rtl:rotate-180', !collapsed && 'rotate-180 rtl:rotate-0')} />
        </button>
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t('app.name')}>
          <button type="button" aria-label="close" onClick={() => setDrawer(false)} className="absolute inset-0 animate-fade-in cursor-default bg-slate-950/45" />
          <aside className="surface-flat absolute inset-y-0 start-0 w-[280px] animate-rise-in rounded-none border-y-0 border-s-0">
            <SidebarContent collapsed={false} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className={cn('transition-all duration-200', collapsed ? 'lg:ps-[76px]' : 'lg:ps-[264px]')}>
        <header
          className="sticky top-0 z-20 border-b bg-white/85 backdrop-blur dark:bg-slate-950/80"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-1.5 px-4">
            <button type="button" onClick={() => setDrawer(true)} className="btn-icon lg:hidden" aria-label="menu">
              <Menu size={19} />
            </button>
            <HeaderSearch key={location.pathname === '/search' ? 'on-search' : 'off-search'} />
            <div className="ms-auto flex items-center gap-1">
              <Link to="/search" className="btn-icon sm:hidden" aria-label={t('nav.search')}>
                <Search size={18} />
              </Link>
              <HeaderBell />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}

function HeaderBell(): JSX.Element {
  const { data } = useUnreadCount();
  const unread = data?.unread ?? 0;
  return (
    <Link to="/notifications" className="btn-icon relative" aria-label={t('notifications.title')}>
      <Bell size={18} />
      {unread > 0 && (
        <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold leading-4 text-white">
          {unread > 99 ? '۹۹+' : unread}
        </span>
      )}
    </Link>
  );
}
