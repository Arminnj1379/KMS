import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from './organization.schema';

export type DepartmentDocument = HydratedDocument<Department>;

/** Department tree. `path` is materialized for cycle checks + subtree moves. */
@Schema({ collection: 'departments', timestamps: true })
export class Department {
  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', default: null })
  parentId!: Types.ObjectId | null;

  @Prop({ required: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, maxlength: 80 })
  slug!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ required: true, default: '/' })
  path!: string;

  @Prop({ required: true, default: 0 })
  depth!: number;

  createdAt!: Date;

  updatedAt!: Date;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
DepartmentSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
DepartmentSchema.index({ organizationId: 1, parentId: 1 });
DepartmentSchema.index({ organizationId: 1, path: 1 });
