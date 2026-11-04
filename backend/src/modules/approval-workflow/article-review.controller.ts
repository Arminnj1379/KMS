import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { SubmitReviewDto } from './dto/approval.dto';

@ApiTags('article-review')
@ApiBearerAuth()
@Controller('knowledge-bases/:kbId/articles/:articleId')
export class ArticleReviewController {
  constructor(private readonly workflow: ApprovalWorkflowService) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit a draft for review (writer; assigns a KB reviewer)' })
  submit(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.workflow.submit(me.orgId, me.userId, me.orgRole, kbId, articleId, dto);
  }

  @Get('review-requests')
  @ApiOperation({ summary: 'Review requests of one article, newest first (read access)' })
  list(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.workflow.listForArticle(me.orgId, me.userId, me.orgRole, kbId, articleId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Append-only workflow history of one article (read access)' })
  history(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.workflow.historyForArticle(me.orgId, me.userId, me.orgRole, kbId, articleId);
  }
}
