import { ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '../../i18n';
import { formatFaNumber } from '../lib/format-fa';
import { Button } from './Button';

/** Prev/next paging. In RTL the "previous" control sits on the right. */
export function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}): JSX.Element | null {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={t('common.pagination')} className="flex items-center justify-center gap-3 pt-2">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronRight size={15} />
        {t('common.prev')}
      </Button>
      <span className="meta tabular-nums">
        {formatFaNumber(page)} / {formatFaNumber(totalPages)}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        {t('common.next')}
        <ChevronLeft size={15} />
      </Button>
    </nav>
  );
}
