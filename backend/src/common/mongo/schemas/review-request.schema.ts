import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Article } from './article.schema';
import { User } from './user.schema';

export type ReviewRequestDocument = HydratedDocument<ReviewRequest>;

/** Phase 6+. Status: pending | approved | rejected | cancelled. */
@Schema({ collection: 'review_requests', timestamps: true })
export class ReviewRequest {
  @Prop({ type: Types.ObjectId, ref: Article.name, required: true })
  articleId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  requesterId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  reviewerId!: Types.ObjectId;

  @Prop({ required: true, default: 'pending' })
  status!: string;

  @Prop({ type: String, default: null })
  comment!: string | null;

  @Prop({ type: Date, default: null })
  decidedAt!: Date | null;

  createdAt!: Date;

  updatedAt!: Date;
}

export const ReviewRequestSchema = SchemaFactory.createForClass(ReviewRequest);
ReviewRequestSchema.index({ articleId: 1, status: 1 });
ReviewRequestSchema.index({ reviewerId: 1, status: 1 });
