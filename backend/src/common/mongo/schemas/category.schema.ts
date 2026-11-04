import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { KnowledgeBase } from './knowledge-base.schema';

export type CategoryDocument = HydratedDocument<Category>;

/** Phase 3+. Category tree per KB (`path` materialized, same rules as departments). */
@Schema({ collection: 'categories', timestamps: true })
export class Category {
  @Prop({ type: Types.ObjectId, ref: KnowledgeBase.name, required: true })
  knowledgeBaseId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  parentId!: Types.ObjectId | null;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  slug!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ required: true, default: 0 })
  position!: number;

  @Prop({ required: true, default: '/' })
  path!: string;

  @Prop({ required: true, default: 0 })
  depth!: number;

  createdAt!: Date;

  updatedAt!: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index({ knowledgeBaseId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ knowledgeBaseId: 1, parentId: 1, position: 1 });
CategorySchema.index({ knowledgeBaseId: 1, path: 1 });
