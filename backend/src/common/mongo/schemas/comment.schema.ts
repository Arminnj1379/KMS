import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Article } from './article.schema';
import { User } from './user.schema';

export type CommentDocument = HydratedDocument<Comment>;

/** Phase 4+. Article-scoped, one-level threads via parentId. */
@Schema({ collection: 'comments', timestamps: true })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: Article.name, required: true })
  articleId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  authorId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Comment', default: null })
  parentId!: Types.ObjectId | null;

  @Prop({ required: true })
  body!: string;

  createdAt!: Date;

  updatedAt!: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
CommentSchema.index({ articleId: 1, createdAt: 1 });
