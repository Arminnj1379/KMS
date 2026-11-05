import type { I18nKey } from '../../i18n';

const TYPE_KEYS: Record<string, I18nKey> = {
  'review.submitted': 'notifications.types.submitted',
  'review.approved': 'notifications.types.approved',
  'review.rejected': 'notifications.types.rejected',
  'review.cancelled': 'notifications.types.cancelled',
};

export function notificationTypeKey(type: string): I18nKey {
  return TYPE_KEYS[type] ?? 'notifications.types.generic';
}
