import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import {
  AddMemberDto,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  UpdateMemberDto,
  UpdateOrganizationDto,
} from './dto/organizations.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations/current')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'Current organization workspace' })
  getCurrent(@CurrentUser() me: AuthenticatedUser) {
    return this.orgs.getCurrent(me.orgId);
  }

  @Patch()
  @Roles('org-admin')
  @ApiOperation({ summary: 'Update organization profile (org-admin)' })
  update(@CurrentUser() me: AuthenticatedUser, @Body() dto: UpdateOrganizationDto) {
    return this.orgs.update(me.orgId, dto);
  }

  @Get('departments')
  @ApiOperation({ summary: 'Department tree' })
  departments(@CurrentUser() me: AuthenticatedUser) {
    return this.orgs.listDepartments(me.orgId);
  }

  @Post('departments')
  @Roles('org-admin')
  @ApiOperation({ summary: 'Create department (org-admin)' })
  createDepartment(@CurrentUser() me: AuthenticatedUser, @Body() dto: CreateDepartmentDto) {
    return this.orgs.createDepartment(me.orgId, dto);
  }

  @Patch('departments/:id')
  @Roles('org-admin')
  @ApiOperation({ summary: 'Rename / move department (org-admin)' })
  updateDepartment(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.orgs.updateDepartment(me.orgId, id, dto);
  }

  @Delete('departments/:id')
  @Roles('org-admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete empty department (org-admin)' })
  async deleteDepartment(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.orgs.deleteDepartment(me.orgId, id);
  }

  @Get('members')
  @ApiOperation({ summary: 'Organization roster (any member)' })
  members(@CurrentUser() me: AuthenticatedUser) {
    return this.orgs.listMembers(me.orgId);
  }

  @Post('members')
  @Roles('org-admin')
  @ApiOperation({ summary: 'Attach an existing user (org-admin)' })
  addMember(@CurrentUser() me: AuthenticatedUser, @Body() dto: AddMemberDto) {
    return this.orgs.addMember(me.orgId, dto);
  }

  @Patch('members/:userId')
  @Roles('org-admin')
  @ApiOperation({ summary: 'Change member role / department (org-admin)' })
  updateMember(
    @CurrentUser() me: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.orgs.updateMember(me.orgId, userId, dto);
  }

  @Delete('members/:userId')
  @Roles('org-admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member (org-admin, never self / last admin)' })
  async removeMember(
    @CurrentUser() me: AuthenticatedUser,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.orgs.removeMember(me.orgId, me.userId, userId);
  }
}
