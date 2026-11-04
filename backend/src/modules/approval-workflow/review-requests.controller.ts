import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { DecideReviewDto, InboxQuery } from './dto/approval.dto';

@ApiTags('review-requests')
@ApiBearerAuth()
@Controller('review-requests')
export class ReviewRequestsController {
  constructor(private readonly workflow: ApprovalWorkflowService) {}

  @Get()
  @ApiOperation({ summary: 'Cross-KB review inbox (assigned to me / requested by me, org-scoped)' })
  inbox(@CurrentUser() me: AuthenticatedUser, @Query() query: InboxQuery) {
    return this.workflow.inbox(me.orgId, me.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One review request (party or KB manager)' })
  findOne(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.workflow.findOne(me.orgId, me.userId, me.orgRole, id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve: in_review → published (assigned reviewer or manager)' })
  approve(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecideReviewDto,
  ) {
    return this.workflow.decide(me.orgId, me.userId, me.orgRole, id, 'approve', dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject: in_review → draft (assigned reviewer or manager)' })
  reject(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecideReviewDto,
  ) {
    return this.workflow.decide(me.orgId, me.userId, me.orgRole, id, 'reject', dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending request: in_review → draft (requester or manager)' })
  cancel(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.workflow.cancel(me.orgId, me.userId, me.orgRole, id);
  }
}
