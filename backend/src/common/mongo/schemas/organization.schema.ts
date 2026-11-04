import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type OrganizationDocument = HydratedDocument<Organization>;

@Schema({ collection: 'organizations', timestamps: true })
export class Organization {
  @Prop({ required: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, maxlength: 80 })
  slug!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ type: String, default: null })
  logoUrl!: string | null;

  createdAt!: Date;

  updatedAt!: Date;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
OrganizationSchema.index({ slug: 1 }, { unique: true });
