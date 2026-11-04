import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Department } from './department.schema';
import { Organization } from './organization.schema';
import { User } from './user.schema';

export type MembershipDocument = HydratedDocument<Membership>;

export type MembershipRole = 'org-admin' | 'member';

/** Organization membership + org role. Separate collection (many-to-many). */
@Schema({ collection: 'memberships', timestamps: true })
export class Membership {
  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, default: 'member' })
  role!: string;

  @Prop({ type: Types.ObjectId, ref: Department.name, default: null })
  departmentId!: Types.ObjectId | null;

  createdAt!: Date;

  updatedAt!: Date;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);
MembershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
MembershipSchema.index({ userId: 1 });
MembershipSchema.index({ organizationId: 1, role: 1 });
