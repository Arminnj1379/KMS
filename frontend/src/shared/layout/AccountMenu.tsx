import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { t } from '../../i18n';
import { useLogout, useMe } from '../../features/auth/hooks';
import { applyTheme, isDarkTheme } from '../lib/theme';
import { Avatar } from '../ui/Chrome';
import { Popover } from '../ui/Popover';

export function AccountMenu(): JSX.Element {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [dark, setDark] = useState<boolean>(isDarkTheme);
  const user = me.data?.user ?? null;

  async function onLogout(): Promise<void> {
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  }

  return (
    <Popover
      align="end"
      className="w-64"
      renderTrigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t('nav.account')}
          className="rounded-full transition-shadow hover:ring-4 hover:ring-surface-sunken"
        >
          {user ? <Avatar name={user.fullName} /> : <span className="skeleton block h-9 w-9 rounded-full" aria-hidden />}
        </button>
      )}
    >
      {(close) => (
        <div role="menu">
          {user && (
            <div className="flex items-center gap-3 px-2.5 py-2.5">
              <Avatar name={user.fullName} />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold leading-5">{user.fullName}</p>
                <p dir="ltr" className="truncate text-start text-[12px] leading-5 text-ink-3">
                  {user.email}
                </p>
              </div>
            </div>
          )}
          <div className="my-1 border-t border-line" />
          <Link to="/profile" onClick={close} role="menuitem" className="navlink w-full">
            <UserRound size={17} className="shrink-0" />
            {t('nav.profile')}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const next = !dark;
              applyTheme(next);
              setDark(next);
            }}
            className="navlink w-full"
          >
            {dark ? <Sun size={17} className="shrink-0" /> : <Moon size={17} className="shrink-0" />}
            {dark ? t('nav.themeLight') : t('nav.themeDark')}
          </button>
          <div className="my-1 border-t border-line" />
          <button type="button" role="menuitem" onClick={() => void onLogout()} className="navlink w-full text-danger hover:text-danger">
            <LogOut size={17} className="shrink-0" />
            {t('auth.logout')}
          </button>
        </div>
      )}
    </Popover>
  );
}
