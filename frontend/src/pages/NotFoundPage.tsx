import { Link } from 'react-router-dom';
import { t } from '../i18n';

export function NotFoundPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-5xl font-bold">۴۰۴</p>
      <p className="mt-2 text-slate-500">{t('common.empty')}</p>
      <Link to="/" className="mt-6 inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm text-white">
        {t('nav.dashboard')}
      </Link>
    </div>
  );
}
