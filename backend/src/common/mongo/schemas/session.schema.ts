import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from './user.schema';

export type RefreshSessionDocument = HydratedDocument<RefreshSession>;

/** Opaque refresh-token sessions. `refreshHash` is sha256 hex (unique). */
@Schema({ collection: 'sessions', timestamps: false })
export class RefreshSession {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  refreshHash!: string;

  @Prop({ required: true })
  familyId!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, default: null })
  ip!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const RefreshSessionSchema = SchemaFactory.createForClass(RefreshSession);
RefreshSessionSchema.index({ refreshHash: 1 }, { unique: true });
RefreshSessionSchema.index({ familyId: 1 });
RefreshSessionSchema.index({ userId: 1 });
RefreshSessionSchema.index({ expiresAt: 1 });
