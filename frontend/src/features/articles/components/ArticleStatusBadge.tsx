import { t, type I18nKey } from '../../../i18n';
import { Badge, type Tone } from '../../../shared/ui/Badge';

const STATUS: Record<string, { tone: Tone; label: I18nKey }> = {
  draft: { tone: 'neutral', label: 'article.status_draft' },
  in_review: { tone: 'warn', label: 'article.status_in_review' },
  published: { tone: 'success', label: 'article.status_published' },
  archived: { tone: 'outline', label: 'article.status_archived' },
};

export function articleStatusLabel(status: string): string {
  const entry = STATUS[status];
  return entry ? t(entry.label) : status;
}

export function ArticleStatusBadge({ status }: { status: string }): JSX.Element {
  const entry = STATUS[status];
  return (
    <Badge tone={entry?.tone ?? 'neutral'} dot>
      {articleStatusLabel(status)}
    </Badge>
  );
}
