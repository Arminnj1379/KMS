import { Injectable, Logger } from '@nestjs/common';
import { NotificationsPort, type NotifyInput } from './notifications.port';

/** Phase 6 default: structured log only. Phase 8 persists to `notifications`. */
@Injectable()
export class LoggingNotificationsService extends NotificationsPort {
  private readonly logger = new Logger(LoggingNotificationsService.name);

  async notify(input: NotifyInput): Promise<void> {
    this.logger.log(`notify ${input.type} -> user ${input.userId}: ${input.title}`);
  }
}
