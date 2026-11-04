import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { DocumentsService } from './documents.service';
import { AttachExistingDto } from './dto/documents.dto';

@ApiTags('article-attachments')
@ApiBearerAuth()
@Controller('knowledge-bases/:kbId/articles/:articleId/attachments')
export class ArticleAttachmentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Enriched attachment list (read access)' })
  list(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.documents.listArticleAttachments(me.orgId, me.userId, me.orgRole, kbId, articleId);
  }

  @Post()
  @ApiOperation({ summary: 'Attach an existing org document (writer)' })
  attach(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
    @Body() dto: AttachExistingDto,
  ) {
    return this.documents.attachExisting(me.orgId, me.userId, me.orgRole, kbId, articleId, dto.documentId);
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Detach (link removed, document row retained; writer)' })
  async detach(
    @CurrentUser() me: AuthenticatedUser,
    @Param('kbId') kbId: string,
    @Param('articleId') articleId: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.documents.detach(me.orgId, me.userId, me.orgRole, kbId, articleId, documentId);
  }
}
