import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText } from 'lucide-react';
import { t } from '../../i18n';

/** Split auth layout: brand panel (start side) + form card. */
export function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}): JSX.Element {
  return (
    <div className="grid min-h-[80vh] items-stretch gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden flex-col justify-between overflow-hidden rounded-card bg-slate-900 p-8 text-white lg:flex dark:bg-brand-950">
        <Link to="/" className="flex items-center gap-2.5" aria-label={t('app.name')}>
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-white/10 text-lg font-bold">
            د
          </span>
          <span className="text-[15px] font-bold">{t('app.name')}</span>
        </Link>
        <div>
          <p className="max-w-sm text-[26px] font-bold leading-[2]">
            دانش سازمانی،
            <br />
            ساخت‌یافته و قابل اتکا
          </p>
          <p className="mt-3 max-w-sm text-sm leading-7 text-slate-300">
            پایگاه‌های دانش، چرخه بررسی، نسخه‌بندی و جست‌وجوی یکپارچه — همه در یک سامانه.
          </p>
          <div className="mt-8 flex items-center gap-2 text-xs text-slate-400">
            <BookOpenText size={15} />
            <span>مقالات · بررسی‌ها · نسخه‌ها · پیوست‌ها</span>
          </div>
        </div>
        <p className="text-xs text-slate-500">{t('app.tagline')}</p>
      </div>

      <div className="flex items-center justify-center py-8">
        <div className="w-full max-w-md">
          <div className="surface p-7 shadow-lift sm:p-8">
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
