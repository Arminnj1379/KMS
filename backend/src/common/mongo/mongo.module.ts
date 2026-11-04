import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from './schemas/article.schema';
import { ArticleVersion, ArticleVersionSchema } from './schemas/article-version.schema';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { Department, DepartmentSchema } from './schemas/department.schema';
import { KmsDocument, KmsDocumentSchema } from './schemas/document.schema';
import { KbMember, KbMemberSchema } from './schemas/kb-member.schema';
import { KnowledgeBase, KnowledgeBaseSchema } from './schemas/knowledge-base.schema';
import { Membership, MembershipSchema } from './schemas/membership.schema';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import { RefreshSession, RefreshSessionSchema } from './schemas/session.schema';
import { ReviewRequest, ReviewRequestSchema } from './schemas/review-request.schema';
import { Tag, TagSchema } from './schemas/tag.schema';
import { User, UserSchema } from './schemas/user.schema';
import { WorkflowHistory, WorkflowHistorySchema } from './schemas/workflow-history.schema';

/**
 * Global persistence module — the Mongoose counterpart of the former
 * global `PrismaModule` (see D-016). Owns the connection and registers
 * every collection schema; services inject `Model<T>` and always `.lean()`
 * + map to plain shapes (documents never cross service boundaries).
 * Module dependency direction is unchanged: services, never models, are
 * the cross-module contract.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env['MONGODB_URI'],
        autoIndex: process.env['NODE_ENV'] !== 'production',
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: RefreshSession.name, schema: RefreshSessionSchema },
      { name: KnowledgeBase.name, schema: KnowledgeBaseSchema },
      { name: KbMember.name, schema: KbMemberSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Article.name, schema: ArticleSchema },
      { name: ArticleVersion.name, schema: ArticleVersionSchema },
      { name: Tag.name, schema: TagSchema },
      { name: KmsDocument.name, schema: KmsDocumentSchema },
      { name: ReviewRequest.name, schema: ReviewRequestSchema },
      { name: WorkflowHistory.name, schema: WorkflowHistorySchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongoModule {}
