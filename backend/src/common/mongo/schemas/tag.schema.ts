import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from './organization.schema';

export type TagDocument = HydratedDocument<Tag>;

/** Phase 4+. Org-owned tags; `slug` lowercased on write (replaces citext). */
@Schema({ collection: 'tags', timestamps: false })
export class Tag {
  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organizationId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  slug!: string;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const TagSchema = SchemaFactory.createForClass(Tag);
TagSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
