import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Article } from './article.schema';
import { KnowledgeBase } from './knowledge-base.schema';
import { Organization } from './organization.schema';
import { User } from './user.schema';

/**
 * Phase 6+. Status: pending | approved | rejected | cancelled.
 * Denormalized display/org fields (organizationId, knowledgeBaseId, titles)
 * are snapshotted at submit so the cross-KB inbox stays a single org-scoped
 * query (same embed pattern as Phase 8 notifications).
 */
export type ReviewRequestDocument = HydratedDocument<ReviewRequest>;

@Schema({ collection: 'review_requests', timestamps: true })
export class ReviewRequest {
  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: KnowledgeBase.name, required: true })
  knowledgeBaseId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Article.name, required: true })
  articleId!: Types.ObjectId;

  @Prop({ required: true })
  articleTitle!: string;

  @Prop({ required: true })
  articleSlug!: string;

  @Prop({ required: true })
  kbTitle!: string;

  @Prop({ required: true })
  kbSlug!: string;

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
ReviewRequestSchema.index({ organizationId: 1, reviewerId: 1, status: 1, createdAt: -1 });
ReviewRequestSchema.index({ organizationId: 1, requesterId: 1, status: 1, createdAt: -1 });
