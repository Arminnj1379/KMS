import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from './organization.schema';
import { User } from './user.schema';

export type KmsDocumentDocument = HydratedDocument<KmsDocument>;

/** Phase 5+. Stored objects (bytes in MinIO/S3); rows retained after unlink. */
@Schema({ collection: 'documents', timestamps: false })
export class KmsDocument {
  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  uploaderId!: Types.ObjectId;

  @Prop({ required: true })
  objectKey!: string;

  @Prop({ required: true })
  filename!: string;

  @Prop({ required: true })
  mime!: string;

  @Prop({ required: true })
  sizeBytes!: number;

  @Prop({ type: String, default: null })
  checksumSha256!: string | null;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const KmsDocumentSchema = SchemaFactory.createForClass(KmsDocument);
KmsDocumentSchema.index({ objectKey: 1 }, { unique: true });
KmsDocumentSchema.index({ organizationId: 1, createdAt: -1 });
