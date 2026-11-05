import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { t } from '../i18n';

export function NotFoundPage(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <p dir="ltr" className="font-mono text-[64px] font-bold leading-none tracking-tight text-line-strong tabular-nums">
        404
      </p>
      <h1 className="mt-6 text-[20px] font-bold">{t('notFound.title')}</h1>
      <p className="mt-2 text-[14px] leading-7 text-ink-3">{t('notFound.hint')}</p>
      <Link to="/" className="btn-primary mt-8">
        <Compass size={16} aria-hidden />
        {t('nav.dashboard')}
      </Link>
    </div>
  );
}
