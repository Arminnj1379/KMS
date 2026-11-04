import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { CategoriesService } from './categories.service';
import {
  AddKbMemberDto,
  CreateCategoryDto,
  CreateKnowledgeBaseDto,
  UpdateCategoryDto,
  UpdateKbMemberDto,
  UpdateKnowledgeBaseDto,
} from './dto/knowledge-bases.dto';
import { KnowledgeBasesService } from './knowledge-bases.service';

@ApiTags('knowledge-bases')
@ApiBearerAuth()
@Controller('knowledge-bases')
export class KnowledgeBasesController {
  constructor(
    private readonly kbs: KnowledgeBasesService,
    private readonly cats: CategoriesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List visible knowledge bases (org-scoped)' })
  list(@CurrentUser() me: AuthenticatedUser) {
    return this.kbs.list(me.orgId, me.userId, me.orgRole);
  }

  @Post()
  @ApiOperation({ summary: 'Create knowledge base (caller becomes manager)' })
  create(@CurrentUser() me: AuthenticatedUser, @Body() dto: CreateKnowledgeBaseDto) {
    return this.kbs.create(me.orgId, me.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Knowledge base detail (id or slug; 404 when invisible)' })
  findOne(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.kbs.findOne(me.orgId, me.userId, me.orgRole, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update knowledge base (manager / org-admin)' })
  update(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.kbs.update(me.orgId, me.userId, me.orgRole, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete knowledge base + members + categories (manager, ?confirm=true)' })
  async remove(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Query('confirm') confirm?: string,
  ): Promise<void> {
    await this.kbs.remove(me.orgId, me.userId, me.orgRole, id, confirm);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'KB member roster (any visible member)' })
  members(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.kbs.listMembers(me.orgId, me.userId, me.orgRole, id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Attach an org member to the KB (manager / org-admin)' })
  addMember(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddKbMemberDto,
  ) {
    return this.kbs.addMember(me.orgId, me.userId, me.orgRole, id, dto);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Change KB member role (manager / org-admin)' })
  updateMember(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateKbMemberDto,
  ) {
    return this.kbs.updateMemberRole(me.orgId, me.userId, me.orgRole, id, userId, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove KB member (manager / org-admin)' })
  async removeMember(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.kbs.removeMember(me.orgId, me.userId, me.orgRole, id, userId);
  }

  @Get(':id/categories')
  @ApiOperation({ summary: 'Category tree (any visible member)' })
  categories(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.cats.listTree(me.orgId, me.userId, me.orgRole, id);
  }

  @Post(':id/categories')
  @ApiOperation({ summary: 'Create category (manager / org-admin)' })
  createCategory(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.cats.create(me.orgId, me.userId, me.orgRole, id, dto);
  }

  @Patch(':id/categories/:catId')
  @ApiOperation({ summary: 'Rename / move category (manager / org-admin)' })
  updateCategory(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Param('catId') catId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.cats.update(me.orgId, me.userId, me.orgRole, id, catId, dto);
  }

  @Delete(':id/categories/:catId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete empty category (manager / org-admin)' })
  async removeCategory(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Param('catId') catId: string,
  ): Promise<void> {
    await this.cats.remove(me.orgId, me.userId, me.orgRole, id, catId);
  }
}
