import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { KnowledgeBase } from './knowledge-base.schema';
import { User } from './user.schema';

export type KbMemberDocument = HydratedDocument<KbMember>;

/** Phase 3+. KB membership. Roles: manager | contributor | reviewer | reader. */
@Schema({ collection: 'kb_members', timestamps: false })
export class KbMember {
  @Prop({ type: Types.ObjectId, ref: KnowledgeBase.name, required: true })
  knowledgeBaseId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, default: 'reader' })
  role!: string;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const KbMemberSchema = SchemaFactory.createForClass(KbMember);
KbMemberSchema.index({ knowledgeBaseId: 1, userId: 1 }, { unique: true });
// Phase 9: cross-KB scoping (`accessibleKbIds`) queries by userId alone.
KbMemberSchema.index({ userId: 1 });
