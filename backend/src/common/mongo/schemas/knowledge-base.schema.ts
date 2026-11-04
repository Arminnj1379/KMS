import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from './organization.schema';
import { User } from './user.schema';

export type KnowledgeBaseDocument = HydratedDocument<KnowledgeBase>;

/** Phase 3+. Visibility: private | internal | public (default internal). */
@Schema({ collection: 'knowledge_bases', timestamps: true })
export class KnowledgeBase {
  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organizationId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  slug!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ type: String, default: null })
  icon!: string | null;

  @Prop({ required: true, default: 'internal' })
  visibility!: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  ownerId!: Types.ObjectId;

  createdAt!: Date;

  updatedAt!: Date;
}

export const KnowledgeBaseSchema = SchemaFactory.createForClass(KnowledgeBase);
KnowledgeBaseSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
KnowledgeBaseSchema.index({ organizationId: 1, visibility: 1 });
