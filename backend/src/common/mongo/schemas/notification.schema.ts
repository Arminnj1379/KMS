import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from './user.schema';

export type NotificationDocument = HydratedDocument<Notification>;

/** Phase 8+. In-app notifications, per-user paged by read state. */
@Schema({ collection: 'notifications', timestamps: false })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  type!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: String, default: null })
  body!: string | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  data!: unknown;

  @Prop({ required: true, default: false })
  isRead!: boolean;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
