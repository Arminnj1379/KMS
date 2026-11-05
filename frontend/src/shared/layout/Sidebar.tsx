import { Link, NavLink } from 'react-router-dom';
import {
  Activity,
  Bell,
  BookOpenText,
  Check,
  ChevronsRight,
  ChevronsUpDown,
  ClipboardCheck,
  LayoutDashboard,
  Search,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { t, type I18nKey } from '../../i18n';
import { useMe } from '../../features/auth/hooks';
import { useReviewInbox } from '../../features/approval/hooks';
import { useUnreadCount } from '../../features/notifications/hooks';
import { formatFaNumber } from '../lib/format-fa';
import { cn } from '../lib/cn';
import { Avatar } from '../ui/Chrome';
import { BrandMark } from '../ui/BrandMark';
import { Popover } from '../ui/Popover';

type Badge = 'reviews' | 'unread';

interface NavItem {
  to: string;
  label: I18nKey;
  icon: LucideIcon;
  end?: boolean;
  badge?: Badge;
}

interface NavGroup {
  title: I18nKey;
  items: NavItem[];
  adminOnly?: boolean;
}

const GROUPS: NavGroup[] = [
  {
    title: 'nav.groups.knowledge',
    items: [
      { to: '/', label: 'nav.dashboard', icon: LayoutDashboard, end: true },
      { to: '/kbs', label: 'nav.knowledgeBases', icon: BookOpenText },
      { to: '/search', label: 'nav.search', icon: Search },
    ],
  },
  {
    title: 'nav.groups.work',
    items: [
      { to: '/reviews', label: 'nav.reviews', icon: ClipboardCheck, badge: 'reviews' },
      { to: '/notifications', label: 'nav.notifications', icon: Bell, badge: 'unread' },
    ],
  },
  {
    title: 'nav.groups.admin',
    adminOnly: true,
    items: [
      { to: '/admin', label: 'nav.admin', icon: Users },
      { to: '/activity', label: 'nav.activity', icon: Activity },
    ],
  },
];

export function useBadgeCounts(): Record<Badge, number> {
  const inbox = useReviewInbox({ role: 'reviewer', status: 'pending', pageSize: 1 });
  const unread = useUnreadCount();
  return { reviews: inbox.data?.total ?? 0, unread: unread.data?.unread ?? 0 };
}

function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }): JSX.Element {
  const me = useMe();
  const memberships = me.data?.memberships ?? [];
  const current = memberships[0];

  if (!current) return <div className={cn('skeleton', collapsed ? 'h-9 w-9' : 'h-14')} aria-hidden />;

  const roleLabel = current.role === 'org-admin' ? t('roles.orgAdmin') : t('roles.member');

  return (
    <Popover
      align="start"
      className="w-64"
      renderTrigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={`${t('nav.workspace')}: ${current.organization.name}`}
          title={collapsed ? current.organization.name : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-control border border-line bg-surface-muted p-2 text-start transition-colors hover:bg-surface-sunken',
            collapsed && 'justify-center border-transparent bg-transparent p-1',
          )}
        >
          <span className="tile tile-0 h-8 w-8 text-[13px]">{current.organization.name.charAt(0) || '؟'}</span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold leading-5">{current.organization.name}</span>
                <span className="block truncate text-[12px] leading-5 text-ink-3">{roleLabel}</span>
              </span>
              <ChevronsUpDown size={15} className="shrink-0 text-ink-4" aria-hidden />
            </>
          )}
        </button>
      )}
    >
      {() => (
        <div>
          <p className="px-2.5 pb-1.5 pt-2 text-[12px] font-medium text-ink-4">{t('nav.workspace')}</p>
          <ul>
            {memberships.map((m) => {
              const active = m.organization.id === current.organization.id;
              return (
                <li key={m.organization.id}>
                  <button
                    type="button"
                    disabled={!active}
                    aria-current={active ? 'true' : undefined}
                    className="flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-start transition-colors hover:bg-surface-sunken disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{m.organization.name}</span>
                    {active && <Check size={16} className="shrink-0 text-accent" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-1 border-t border-line px-2.5 pb-1 pt-2.5 text-[12px] leading-5 text-ink-3">{t('nav.workspaceHint')}</p>
        </div>
      )}
    </Popover>
  );
}

export function Sidebar({
  collapsed,
  onNavigate,
  onToggle,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggle?: () => void;
}): JSX.Element {
  const me = useMe();
  const counts = useBadgeCounts();
  const user = me.data?.user ?? null;
  const isAdmin = me.data?.memberships.some((m) => m.role === 'org-admin') ?? false;
  const groups = GROUPS.filter((g) => !g.adminOnly || isAdmin);

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 shrink-0 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <Link to="/" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5" aria-label={t('app.name')}>
          <BrandMark size={30} />
          {!collapsed && <span className="truncate text-[15px] font-bold">{t('app.name')}</span>}
        </Link>
      </div>

      <div className="px-2.5 pb-3">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      <nav aria-label="primary" className="flex-1 space-y-5 overflow-y-auto px-2.5 pb-4">
        {groups.map((group, index) => (
          <div key={group.title}>
            {collapsed ? (
              index > 0 && <div className="mx-2.5 mb-3 border-t border-line" />
            ) : (
              <p className="mb-1.5 px-3 text-[12px] font-medium text-ink-4">{t(group.title)}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      title={collapsed ? t(item.label) : undefined}
                      aria-label={collapsed ? t(item.label) : undefined}
                      className={({ isActive }) => cn('navlink', isActive && 'navlink-active', collapsed && 'justify-center px-0')}
                    >
                      <span className="relative flex shrink-0">
                        <Icon size={18} strokeWidth={1.75} />
                        {collapsed && count > 0 && (
                          <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" aria-hidden />
                        )}
                      </span>
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>}
                      {!collapsed && count > 0 && (
                        <span className="badge-accent h-5 min-w-5 justify-center px-1.5 text-[11.5px] tabular-nums">
                          {formatFaNumber(count)}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-line p-2.5">
        {user ? (
          <Link
            to="/profile"
            onClick={onNavigate}
            title={collapsed ? user.fullName : undefined}
            className={cn(
              'flex items-center gap-3 rounded-control p-2 transition-colors hover:bg-surface-sunken',
              collapsed && 'justify-center p-1',
            )}
          >
            <Avatar name={user.fullName} />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold leading-5">{user.fullName}</span>
                <span dir="ltr" className="block truncate text-start text-[12px] leading-5 text-ink-3">
                  {user.email}
                </span>
              </span>
            )}
          </Link>
        ) : (
          <div className="skeleton h-12" aria-hidden />
        )}
        {onToggle && (
          <button type="button" onClick={onToggle} className={cn('navlink w-full', collapsed && 'justify-center px-0')} aria-label={collapsed ? t('nav.expand') : t('nav.collapse')} title={collapsed ? t('nav.expand') : t('nav.collapse')}>
            <ChevronsRight size={18} className={cn('shrink-0 transition-transform duration-200', collapsed ? 'rtl:rotate-180' : 'rotate-180 rtl:rotate-0')} aria-hidden />
            {!collapsed && <span className="truncate">{t('nav.collapse')}</span>}
          </button>
        )}
      </div>
    </div>
  );
}
