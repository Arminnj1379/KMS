import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/**
 * Phase 8+. Append-only. `organizationId`/`actorId` are stored as hex
 * strings with NO refs (polymorphic by design — login events have no org).
 */
@Schema({ collection: 'audit_logs', timestamps: false })
export class AuditLog {
  @Prop({ type: String, default: null })
  organizationId!: string | null;

  @Prop({ type: String, default: null })
  actorId!: string | null;

  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  resourceType!: string;

  @Prop({ required: true })
  resourceId!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  metadata!: unknown;

  @Prop({ type: String, default: null })
  ip!: string | null;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ organizationId: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });
