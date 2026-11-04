import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { InviteUserDto, ListUsersQuery, UpdateMeDto, UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('org-admin')
  @ApiOperation({ summary: 'List organization users (org-admin)' })
  list(@CurrentUser() me: AuthenticatedUser, @Query() query: ListUsersQuery) {
    return this.users.list(me.orgId, query);
  }

  @Post()
  @Roles('org-admin')
  @ApiOperation({ summary: 'Invite existing user or create a new one (org-admin)' })
  invite(@CurrentUser() me: AuthenticatedUser, @Body() dto: InviteUserDto) {
    return this.users.invite(me.orgId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Own profile row' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.findOne(user.orgId, user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One organization user (any member, org-scoped)' })
  findOne(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.users.findOne(me.orgId, id);
  }

  @Patch(':id')
  @Roles('org-admin')
  @ApiOperation({ summary: 'Update organization user (org-admin)' })
  update(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(me.orgId, me.userId, id, dto);
  }
}
