import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Category } from './category.schema';
import { KnowledgeBase } from './knowledge-base.schema';
import { Organization } from './organization.schema';
import { Tag } from './tag.schema';
import { User } from './user.schema';

export type ArticleDocument = HydratedDocument<Article>;

/** Phase 4+. Embedded attachment link (bounded per article; documents live on). */
@Schema({ _id: false })
export class AttachmentLink {
  @Prop({ type: Types.ObjectId, ref: 'KmsDocument', required: true })
  documentId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  createdBy!: Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const AttachmentLinkSchema = SchemaFactory.createForClass(AttachmentLink);

/**
 * Phase 4+. `organizationId` is denormalized so every business query can
 * filter by org without a KB lookup. Tags via `tagIds` (no join collection).
 */
@Schema({ collection: 'articles', timestamps: true })
export class Article {
  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: KnowledgeBase.name, required: true })
  knowledgeBaseId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Category.name, default: null })
  categoryId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  authorId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  slug!: string;

  @Prop({ type: String, default: null })
  summary!: string | null;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  contentJson!: unknown;

  @Prop({ required: true, default: '' })
  contentText!: string;

  @Prop({ type: String, default: null })
  contentHtml!: string | null;

  @Prop({ required: true, default: 'draft' })
  status!: string;

  @Prop({ required: true, default: 1 })
  version!: number;

  @Prop({ required: true, default: 0 })
  viewCount!: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: Tag.name }], default: [] })
  tagIds!: Types.ObjectId[];

  @Prop({ type: [AttachmentLinkSchema], default: [] })
  attachments!: AttachmentLink[];

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  createdAt!: Date;

  updatedAt!: Date;
}

export const ArticleSchema = SchemaFactory.createForClass(Article);
ArticleSchema.index({ knowledgeBaseId: 1, slug: 1 }, { unique: true });
ArticleSchema.index({ knowledgeBaseId: 1, status: 1, publishedAt: -1 });
ArticleSchema.index({ organizationId: 1, status: 1, publishedAt: -1 });
ArticleSchema.index({ authorId: 1 });
ArticleSchema.index({ tagIds: 1 });
ArticleSchema.index(
  { title: 'text', summary: 'text', contentText: 'text' },
  { language_override: 'none', name: 'article_text' },
);
