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
import { ArticlesService } from './articles.service';
import {
  CreateArticleDto,
  ListArticlesQuery,
  UpdateArticleDto,
} from './dto/articles.dto';

@ApiTags('articles')
@ApiBearerAuth()
@Controller('knowledge-bases/:kbId/articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get('tags')
  @ApiOperation({ summary: 'Tags used by articles in this KB (with counts)' })
  tags(@CurrentUser() me: AuthenticatedUser, @Param('kbId') kbId: string) {
    return this.articles.listTags(me.orgId, me.userId, me.orgRole, kbId);
  }

  @Get()
  @ApiOperation({ summary: 'List articles (paginated, filterable)' })
  list(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Query() query: ListArticlesQuery,
  ) {
    return this.articles.list(me.orgId, me.userId, me.orgRole, kbId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create draft article (manager / contributor)' })
  create(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Body() dto: CreateArticleDto,
  ) {
    return this.articles.create(me.orgId, me.userId, me.orgRole, kbId, dto);
  }

  @Get(':articleId/related')
  @ApiOperation({ summary: 'Related published articles (shared tags/category)' })
  related(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.articles.related(me.orgId, me.userId, me.orgRole, kbId, articleId);
  }

  @Get(':articleId')
  @ApiOperation({ summary: 'Article detail by id or slug (increments view count)' })
  findOne(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.articles.findOne(me.orgId, me.userId, me.orgRole, kbId, articleId);
  }

  @Patch(':articleId')
  @ApiOperation({ summary: 'Update article (optimistic version; 409 on conflict)' })
  update(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articles.update(me.orgId, me.userId, me.orgRole, kbId, articleId, dto);
  }

  @Delete(':articleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete article (manager)' })
  async remove(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
  ): Promise<void> {
    await this.articles.remove(me.orgId, me.userId, me.orgRole, kbId, articleId);
  }

  @Post(':articleId/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish (draft/in_review → published; manager)' })
  publish(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.articles.publish(me.orgId, me.userId, me.orgRole, kbId, articleId);
  }

  @Post(':articleId/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish (published → draft; manager)' })
  unpublish(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.articles.unpublish(me.orgId, me.userId, me.orgRole, kbId, articleId);
  }

  @Post(':articleId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive (manager)' })
  archive(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.articles.archive(me.orgId, me.userId, me.orgRole, kbId, articleId);
  }

  @Post(':articleId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore archived → draft (manager)' })
  restore(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.articles.restore(me.orgId, me.userId, me.orgRole, kbId, articleId);
  }
}
