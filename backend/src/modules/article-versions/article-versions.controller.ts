import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { ArticleVersionsService } from './article-versions.service';
import { CreateSnapshotDto, DiffQuery, RestoreVersionDto } from './dto/article-versions.dto';

@ApiTags('article-versions')
@ApiBearerAuth()
@Controller('knowledge-bases/:kbId/articles/:articleId/versions')
export class ArticleVersionsController {
  constructor(private readonly versions: ArticleVersionsService) {}

  @Get()
  @ApiOperation({ summary: 'Version history of an article (read access)' })
  list(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.versions.list(me.orgId, me.userId, me.orgRole, kbId, articleId);
  }

  @Post()
  @ApiOperation({ summary: 'Snapshot the current article state as a named version (writer)' })
  snapshot(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
    @Body() dto: CreateSnapshotDto,
  ) {
    return this.versions.snapshotCurrent(me.orgId, me.userId, me.orgRole, kbId, articleId, dto.changelog);
  }

  @Get(':version/diff')
  @ApiOperation({ summary: 'Line diff between two snapshots (read access)' })
  diff(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
    @Param('version', ParseIntPipe) version: number,
    @Query() query: DiffQuery,
  ) {
    return this.versions.diff(me.orgId, me.userId, me.orgRole, kbId, articleId, version, query.to);
  }

  @Get(':version')
  @ApiOperation({ summary: 'One snapshot by version number (read access)' })
  findOne(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.versions.findOne(me.orgId, me.userId, me.orgRole, kbId, articleId, version);
  }

  @Post(':version/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a snapshot as a NEW article version (writer)' })
  restore(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() dto: RestoreVersionDto,
  ) {
    return this.versions.restore(me.orgId, me.userId, me.orgRole, kbId, articleId, version, dto.changelog);
  }
}
