import type { I18nKey } from '../../i18n';
import type { Tone } from '../../shared/ui/Badge';

const ACTIONS: Record<string, { label: I18nKey; tone: Tone }> = {
  'auth.register': { label: 'activity.actions.authRegister', tone: 'success' },
  'auth.login': { label: 'activity.actions.authLogin', tone: 'neutral' },
  'auth.logout': { label: 'activity.actions.authLogout', tone: 'neutral' },
  'auth.change-password': { label: 'activity.actions.authChangePassword', tone: 'warn' },
  'kb.create': { label: 'activity.actions.kbCreate', tone: 'accent' },
  'kb.update': { label: 'activity.actions.kbUpdate', tone: 'neutral' },
  'kb.delete': { label: 'activity.actions.kbDelete', tone: 'danger' },
  'kb.member.add': { label: 'activity.actions.kbMemberAdd', tone: 'accent' },
  'kb.member.update': { label: 'activity.actions.kbMemberUpdate', tone: 'neutral' },
  'kb.member.remove': { label: 'activity.actions.kbMemberRemove', tone: 'danger' },
  'article.create': { label: 'activity.actions.articleCreate', tone: 'accent' },
  'article.update': { label: 'activity.actions.articleUpdate', tone: 'neutral' },
  'article.delete': { label: 'activity.actions.articleDelete', tone: 'danger' },
  'article.attach': { label: 'activity.actions.articleAttach', tone: 'neutral' },
  'article.detach': { label: 'activity.actions.articleDetach', tone: 'neutral' },
  'article.draft': { label: 'activity.actions.articleDraft', tone: 'neutral' },
  'article.published': { label: 'activity.actions.articlePublished', tone: 'success' },
  'article.archived': { label: 'activity.actions.articleArchived', tone: 'warn' },
  'review.submitted': { label: 'activity.actions.reviewSubmitted', tone: 'accent' },
  'review.approved': { label: 'activity.actions.reviewApproved', tone: 'success' },
  'review.rejected': { label: 'activity.actions.reviewRejected', tone: 'danger' },
  'review.cancelled': { label: 'activity.actions.reviewCancelled', tone: 'neutral' },
};

export const AUDIT_ACTION_CODES = Object.keys(ACTIONS);

export function auditActionLabelKey(action: string): I18nKey | null {
  return ACTIONS[action]?.label ?? null;
}

export function auditActionTone(action: string): Tone {
  return ACTIONS[action]?.tone ?? 'neutral';
}
