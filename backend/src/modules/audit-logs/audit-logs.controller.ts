import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQuery } from './dto/audit-logs.dto';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly audit: AuditLogsService) {}

  @Get()
  @Roles('org-admin')
  @ApiOperation({ summary: 'Organization audit log (org-admin, newest first)' })
  list(@CurrentUser() me: AuthenticatedUser, @Query() query: ListAuditLogsQuery) {
    return this.audit.list(me.orgId, query);
  }
}
