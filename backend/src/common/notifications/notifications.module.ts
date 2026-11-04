import { Module } from '@nestjs/common';
import { LoggingNotificationsService } from './logging-notifications.service';
import { NOTIFICATIONS_PORT } from './notifications.port';

/**
 * Notifications seam (D-005). Imported by ApprovalWorkflowModule (review
 * events). `common/` never imports from `modules/`.
 */
@Module({
  providers: [{ provide: NOTIFICATIONS_PORT, useClass: LoggingNotificationsService }],
  exports: [NOTIFICATIONS_PORT],
})
export class NotificationsModule {}
