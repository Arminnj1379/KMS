import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Article } from './article.schema';
import { User } from './user.schema';

export type ArticleVersionDocument = HydratedDocument<ArticleVersion>;

/** Phase 5+. Immutable snapshots — insert-only, never updated/deleted. */
@Schema({ collection: 'article_versions', timestamps: false })
export class ArticleVersion {
  @Prop({ type: Types.ObjectId, ref: Article.name, required: true })
  articleId!: Types.ObjectId;

  @Prop({ required: true })
  version!: number;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: String, default: null })
  summary!: string | null;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  contentJson!: unknown;

  @Prop({ type: String, default: null })
  contentText!: string | null;

  @Prop({ type: String, default: null })
  changelog!: string | null;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  createdBy!: Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const ArticleVersionSchema = SchemaFactory.createForClass(ArticleVersion);
ArticleVersionSchema.index({ articleId: 1, version: 1 }, { unique: true });
ArticleVersionSchema.index({ articleId: 1, createdAt: 1 });
