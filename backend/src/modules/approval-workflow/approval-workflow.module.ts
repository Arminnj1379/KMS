import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../common/notifications/notifications.module';
import { ArticlesModule } from '../articles/articles.module';
import { KnowledgeBasesModule } from '../knowledge-bases/knowledge-bases.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { ArticleReviewController } from './article-review.controller';
import { ReviewRequestsController } from './review-requests.controller';

/**
 * Review state machine (ARCHITECTURE §7). Depends on ArticlesService,
 * KnowledgeBasesService, PermissionsService and the notifications seam
 * (direction: approval → articles → kbs → orgs; permissions/notifications
 * are sinks). Owns the review_requests + workflow_history models.
 */
@Module({
  imports: [ArticlesModule, KnowledgeBasesModule, PermissionsModule, NotificationsModule],
  controllers: [ArticleReviewController, ReviewRequestsController],
  providers: [ApprovalWorkflowService],
  exports: [ApprovalWorkflowService],
})
export class ApprovalWorkflowModule {}
