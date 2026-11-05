import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Menu, Search } from 'lucide-react';
import { t } from '../../i18n';
import { useUnreadCount } from '../../features/notifications/hooks';
import { formatFaNumber } from '../lib/format-fa';
import { Breadcrumbs } from '../ui/Chrome';
import { useHeaderCrumbs } from '../ui/header-crumbs';
import { AccountMenu } from './AccountMenu';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Global search entry: submits to the full search page; "/" focuses it from anywhere. */
function GlobalSearch(): JSX.Element {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key !== '/' || isTypingTarget(e.target)) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      role="search"
      className="relative w-full min-w-0 md:w-80"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q.length >= 2) navigate(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-4" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('dashboard.searchPh')}
        aria-label={t('nav.search')}
        className="input h-9 border-transparent bg-surface-muted ps-9 pe-10 text-[13.5px] hover:border-transparent focus:bg-surface"
      />
      <span className="kbd pointer-events-none absolute end-2 top-1/2 -translate-y-1/2" aria-hidden>
        /
      </span>
    </form>
  );
}

function NotificationsButton(): JSX.Element {
  const { data } = useUnreadCount();
  const unread = data?.unread ?? 0;
  const label = unread > 0 ? `${t('nav.notifications')} (${formatFaNumber(unread)})` : t('nav.notifications');
  return (
    <Link to="/notifications" className="btn-icon relative" aria-label={label} title={t('nav.notifications')}>
      <Bell size={18} strokeWidth={1.75} />
      {unread > 0 && (
        <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-fg ring-2 ring-surface tabular-nums">
          {unread > 99 ? `${formatFaNumber(99)}+` : formatFaNumber(unread)}
        </span>
      )}
    </Link>
  );
}

export function AppHeader({ onOpenMenu }: { onOpenMenu: () => void }): JSX.Element {
  const { crumbs } = useHeaderCrumbs();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-10">
        <button type="button" onClick={onOpenMenu} className="btn-icon -ms-2 lg:hidden" aria-label={t('nav.openMenu')}>
          <Menu size={18} />
        </button>
        <div className="hidden min-w-0 md:block">
          <Breadcrumbs items={crumbs} />
        </div>
        <div className="ms-auto flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-none">
          <GlobalSearch />
          <NotificationsButton />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
