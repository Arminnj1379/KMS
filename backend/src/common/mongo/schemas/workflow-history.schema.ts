import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Article } from './article.schema';
import { User } from './user.schema';

export type WorkflowHistoryDocument = HydratedDocument<WorkflowHistory>;

/** Phase 6+. Append-only state-machine transitions. */
@Schema({ collection: 'workflow_history', timestamps: false })
export class WorkflowHistory {
  @Prop({ type: Types.ObjectId, ref: Article.name, required: true })
  articleId!: Types.ObjectId;

  @Prop({ required: true })
  fromStatus!: string;

  @Prop({ required: true })
  toStatus!: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  actorId!: Types.ObjectId;

  @Prop({ type: String, default: null })
  comment!: string | null;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const WorkflowHistorySchema = SchemaFactory.createForClass(WorkflowHistory);
WorkflowHistorySchema.index({ articleId: 1, createdAt: 1 });
