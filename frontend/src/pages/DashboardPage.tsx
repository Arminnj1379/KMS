import { useHealth } from '../features/health/hooks';
import { t } from '../i18n';
import { formatFaDate } from '../shared/lib/format-fa';

export function DashboardPage(): JSX.Element {
  const health = useHealth();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('dashboard.subtitle')}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {t('common.backendStatus')}
        </h2>
        {health.isPending && <p className="mt-2 text-sm">{t('common.loading')}</p>}
        {health.isError && (
          <div className="mt-2">
            <p className="text-sm text-red-600">{t('dashboard.disconnected')}</p>
            <button
              type="button"
              onClick={() => void health.refetch()}
              className="mt-2 rounded-lg bg-brand-500 px-3 py-1.5 text-sm text-white"
            >
              {t('common.retry')}
            </button>
          </div>
        )}
        {health.data && (
          <p className="mt-2 text-sm text-emerald-600">
            {t('dashboard.connected')} · {formatFaDate(health.data.timestamp)}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {t('common.empty')} — {t('nav.knowledgeBases')} (فاز ۳)
      </div>
    </section>
  );
}
