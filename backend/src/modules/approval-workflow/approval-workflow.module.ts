import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { KnowledgeBasesModule } from '../knowledge-bases/knowledge-bases.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { ArticleReviewController } from './article-review.controller';
import { ReviewRequestsController } from './review-requests.controller';

/**
 * Review state machine (ARCHITECTURE §7). Depends on ArticlesService,
 * KnowledgeBasesService, PermissionsService, the notifications seam and the
 * audit sink
 * (direction: approval → articles → kbs → orgs; permissions/notifications/audit
 * are sinks). Owns the review_requests + workflow_history models.
 */
@Module({
  imports: [ArticlesModule, KnowledgeBasesModule, PermissionsModule, NotificationsModule, AuditLogsModule],
  controllers: [ArticleReviewController, ReviewRequestsController],
  providers: [ApprovalWorkflowService],
  exports: [ApprovalWorkflowService],
})
export class ApprovalWorkflowModule {}
