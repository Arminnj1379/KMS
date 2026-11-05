import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { t } from '../i18n';
import { EmptyState } from '../shared/ui/Feedback';

export function NotFoundPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-md py-16">
      <p className="text-center text-6xl font-bold tabular-nums text-slate-200 dark:text-slate-700" dir="ltr">404</p>
      <EmptyState
        icon={Compass}
        title={t('notFound.title')}
        hint={t('notFound.hint')}
        action={
          <Link to="/" className="btn-primary btn-sm">
            {t('nav.dashboard')}
          </Link>
        }
      />
    </div>
  );
}
