import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification } from '../../common/mongo/schemas/notification.schema';
import { toObjectIdOrNull } from '../../common/mongo/object-id';
import {
  NOTIFICATIONS_PORT,
  NotificationsPort,
  type NotifyInput,
} from '../../common/notifications/notifications.port';
import { ListNotificationsQuery } from './dto/notifications.dto';

type NotificationLean = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: string;
  title: string;
  body: string | null;
  data: unknown;
  isRead: boolean;
  createdAt: Date;
};

/**
 * Persisted notifications inbox (Phase 8). Implements the `NOTIFICATIONS_PORT`
 * seam from D-022/D-005, so review callers keep firing best-effort post-commit
 * hooks with zero logic change — the provider swap (logging → Mongo) is
 * wiring-only. Later BullMQ fan-out reuses the same token.
 *
 * Direction: sink. Imports nothing from other modules; any module may depend
 * on this one (approval → notifications).
 */
@Injectable()
export class NotificationsService extends NotificationsPort {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@InjectModel(Notification.name) private readonly notificationModel: Model<Notification>) {
    super();
  }

  private toDto(n: NotificationLean) {
    return {
      id: n._id.toHexString(),
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data,
      isRead: n.isRead,
      createdAt: n.createdAt,
    };
  }

  /**
   * Async-ready emitter entry point. Persists one inbox row per call;
   * invalid userIds are dropped with a warning (callers already treat
   * notify as best-effort via `safeNotify`, so this never rejects there —
   * a direct throw here only surfaces DB outages to the hook logger).
   */
  async notify(input: NotifyInput): Promise<void> {
    const userId = toObjectIdOrNull(input.userId);
    if (!userId) {
      this.logger.warn(`notify dropped: invalid userId ${input.userId}`);
      return;
    }
    await this.notificationModel.create({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      data: input.data ?? null,
      isRead: false,
    });
  }

  async list(userId: string, query: ListNotificationsQuery) {
    const me = toObjectIdOrNull(userId);
    if (!me) throw new NotFoundException('کاربر یافت نشد');
    const read = query.readFilter();
    const filter: Record<string, unknown> = {
      userId: me,
      ...(read !== undefined ? { isRead: read } : {}),
    };
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const [total, unread, rows] = await Promise.all([
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({ userId: me, isRead: false }),
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);
    return {
      items: (rows as unknown as NotificationLean[]).map((r) => this.toDto(r)),
      total,
      unread,
      page,
      pageSize,
    };
  }

  async unreadCount(userId: string): Promise<{ unread: number }> {
    const me = toObjectIdOrNull(userId);
    if (!me) throw new NotFoundException('کاربر یافت نشد');
    const unread = await this.notificationModel.countDocuments({ userId: me, isRead: false });
    return { unread };
  }

  async markRead(userId: string, id: string) {
    const me = toObjectIdOrNull(userId);
    const nid = toObjectIdOrNull(id);
    if (!me || !nid) throw new NotFoundException('اعلان یافت نشد');
    const next = (await this.notificationModel
      .findOneAndUpdate({ _id: nid, userId: me }, { $set: { isRead: true } }, { new: true })
      .lean()) as unknown as NotificationLean | null;
    if (!next) throw new NotFoundException('اعلان یافت نشد');
    return this.toDto(next);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const me = toObjectIdOrNull(userId);
    if (!me) throw new NotFoundException('کاربر یافت نشد');
    const res = await this.notificationModel.updateMany({ userId: me, isRead: false }, { $set: { isRead: true } });
    return { updated: res.modifiedCount ?? 0 };
  }
}

/** Re-exported so feature modules can depend on the token without touching `common/`. */
export { NOTIFICATIONS_PORT };
