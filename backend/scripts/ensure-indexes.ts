/**
 * Ensures MongoDB indexes for every collection (idempotent).
 * Used in production where `autoIndex` is disabled (see DEPLOYMENT.md):
 * run `npm run db:indexes` after every deploy. The dev seed calls this too.
 */
import mongoose from 'mongoose';
import { Article, ArticleSchema } from '../src/common/mongo/schemas/article.schema';
import { ArticleVersion, ArticleVersionSchema } from '../src/common/mongo/schemas/article-version.schema';
import { AuditLog, AuditLogSchema } from '../src/common/mongo/schemas/audit-log.schema';
import { Category, CategorySchema } from '../src/common/mongo/schemas/category.schema';
import { Comment, CommentSchema } from '../src/common/mongo/schemas/comment.schema';
import { Department, DepartmentSchema } from '../src/common/mongo/schemas/department.schema';
import { KmsDocument, KmsDocumentSchema } from '../src/common/mongo/schemas/document.schema';
import { KbMember, KbMemberSchema } from '../src/common/mongo/schemas/kb-member.schema';
import { KnowledgeBase, KnowledgeBaseSchema } from '../src/common/mongo/schemas/knowledge-base.schema';
import { Membership, MembershipSchema } from '../src/common/mongo/schemas/membership.schema';
import { Notification, NotificationSchema } from '../src/common/mongo/schemas/notification.schema';
import { Organization, OrganizationSchema } from '../src/common/mongo/schemas/organization.schema';
import { RefreshSession, RefreshSessionSchema } from '../src/common/mongo/schemas/session.schema';
import { ReviewRequest, ReviewRequestSchema } from '../src/common/mongo/schemas/review-request.schema';
import { Tag, TagSchema } from '../src/common/mongo/schemas/tag.schema';
import { User, UserSchema } from '../src/common/mongo/schemas/user.schema';
import { WorkflowHistory, WorkflowHistorySchema } from '../src/common/mongo/schemas/workflow-history.schema';

const models: [string, mongoose.Schema][] = [
  [User.name, UserSchema],
  [Organization.name, OrganizationSchema],
  [Membership.name, MembershipSchema],
  [Department.name, DepartmentSchema],
  [RefreshSession.name, RefreshSessionSchema],
  [KnowledgeBase.name, KnowledgeBaseSchema],
  [KbMember.name, KbMemberSchema],
  [Category.name, CategorySchema],
  [Article.name, ArticleSchema],
  [ArticleVersion.name, ArticleVersionSchema],
  [Tag.name, TagSchema],
  [KmsDocument.name, KmsDocumentSchema],
  [ReviewRequest.name, ReviewRequestSchema],
  [WorkflowHistory.name, WorkflowHistorySchema],
  [Comment.name, CommentSchema],
  [Notification.name, NotificationSchema],
  [AuditLog.name, AuditLogSchema],
];

export async function ensureIndexes(): Promise<string[]> {
  const created: string[] = [];
  for (const [name, schema] of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = mongoose.models[name] as mongoose.Model<any> | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model: mongoose.Model<any> = existing ?? mongoose.model(name, schema);
    await model.createIndexes();
    created.push(name);
  }
  return created;
}

/* eslint-disable no-console */
if (require.main === module) {
  const uri = process.env['MONGODB_URI'];
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }
  mongoose
    .connect(uri)
    .then(() => ensureIndexes())
    .then((names) => console.log(`Indexes ensured for ${names.length} collections: ${names.join(', ')}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => {
      void mongoose.disconnect();
    });
}
