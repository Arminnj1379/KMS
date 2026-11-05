import type { ReactNode } from 'react';
import { ClipboardCheck, History, ShieldCheck } from 'lucide-react';
import { t, type I18nKey } from '../../i18n';
import { BrandMark, STAR_POINTS } from '../../shared/ui/BrandMark';

const FEATURES: { icon: typeof History; label: I18nKey }[] = [
  { icon: History, label: 'auth.feature1' },
  { icon: ClipboardCheck, label: 'auth.feature2' },
  { icon: ShieldCheck, label: 'auth.feature3' },
];

/** Two-pane auth shell. The form sits on the start side (right in RTL); the brand pane carries the star motif. */
export function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}): JSX.Element {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <BrandMark size={32} />
            <span className="text-[15px] font-bold">{t('app.name')}</span>
          </div>
          <h1 className="text-[26px] font-bold leading-10">{title}</h1>
          <p className="mt-2 text-[14px] leading-7 text-ink-3">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-6 text-center text-[13.5px] text-ink-3">{footer}</div>}
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-[#0B3D3A] text-white lg:flex lg:flex-col lg:justify-between lg:p-16 dark:bg-[#071F1D]">
        <svg className="pointer-events-none absolute inset-0 h-full w-full text-white opacity-[0.07]" aria-hidden>
          <defs>
            <pattern id="kms-star-field" width="72" height="72" patternUnits="userSpaceOnUse">
              <polygon points={STAR_POINTS} fill="none" stroke="currentColor" strokeWidth="0.9" transform="translate(18 18) scale(1.5)" />
              <polygon points={STAR_POINTS} fill="none" stroke="currentColor" strokeWidth="0.9" transform="translate(-18 54) scale(1.5)" />
              <polygon points={STAR_POINTS} fill="none" stroke="currentColor" strokeWidth="0.9" transform="translate(54 54) scale(1.5)" />
              <polygon points={STAR_POINTS} fill="none" stroke="currentColor" strokeWidth="0.9" transform="translate(54 -18) scale(1.5)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#kms-star-field)" />
        </svg>

        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-control bg-white/12 ring-1 ring-white/20">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
              <polygon points={STAR_POINTS} />
              <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className="text-[15px] font-bold">{t('app.name')}</span>
        </div>

        <div className="relative max-w-md">
          <p className="text-[32px] font-bold leading-[1.55]">{t('auth.brandTitle')}</p>
          <p className="mt-5 text-[15px] leading-8 text-white/75">{t('auth.brandBody')}</p>
          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-[14px] text-white/85">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10">
                  <Icon size={16} strokeWidth={1.8} aria-hidden />
                </span>
                {t(label)}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12.5px] text-white/50">{t('app.tagline')}</p>
      </aside>
    </div>
  );
}
