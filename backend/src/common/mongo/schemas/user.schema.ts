import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

/** Application users. Email is lowercased on write (replaces citext). */
@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, maxlength: 254, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, maxlength: 120 })
  fullName!: string;

  @Prop({ type: String, default: null })
  avatarUrl!: string | null;

  @Prop({ default: 'fa' })
  locale!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isSuperAdmin!: boolean;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  createdAt!: Date;

  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
