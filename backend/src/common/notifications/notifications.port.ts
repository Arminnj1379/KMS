/** Input for the notifications seam (D-005). Persistence lands in Phase 8. */
export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

/** Injection token for the seam (string token keeps stack traces readable). */
export const NOTIFICATIONS_PORT = 'NOTIFICATIONS_PORT';

/**
 * Async-ready seam for notifications. Phase 6 ships a logging default;
 * Phase 8 swaps in persistence (and later BullMQ) without touching callers.
 */
export abstract class NotificationsPort {
  abstract notify(input: NotifyInput): Promise<void>;
}
