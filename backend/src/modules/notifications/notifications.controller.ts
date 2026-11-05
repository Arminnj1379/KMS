import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { ListNotificationsQuery } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Own notification inbox (newest first)' })
  list(@CurrentUser() me: AuthenticatedUser, @Query() query: ListNotificationsQuery) {
    return this.notifications.list(me.userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count (for the header bell)' })
  unreadCount(@CurrentUser() me: AuthenticatedUser) {
    return this.notifications.unreadCount(me.userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark every own notification as read' })
  markAllRead(@CurrentUser() me: AuthenticatedUser) {
    return this.notifications.markAllRead(me.userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one own notification as read' })
  markRead(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.notifications.markRead(me.userId, id);
  }
}
