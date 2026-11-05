import { Module } from '@nestjs/common';
import { NOTIFICATIONS_PORT } from '../../common/notifications/notifications.port';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Notifications sink (Phase 8, D-022/D-005). Owns the `NOTIFICATIONS_PORT`
 * provider (persisted), replacing the Phase 6 logging default in
 * `common/notifications` (port file retained as the token contract).
 * Direction: approval → notifications; notifications imports nothing.
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: NOTIFICATIONS_PORT, useExisting: NotificationsService },
  ],
  exports: [NotificationsService, NOTIFICATIONS_PORT],
})
export class NotificationsModule {}
