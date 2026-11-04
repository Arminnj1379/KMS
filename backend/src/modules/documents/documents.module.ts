import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { ArticlesModule } from '../articles/articles.module';
import { ArticleAttachmentsController } from './article-attachments.controller';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

/**
 * Org document library + article attachment links. Depends on
 * ArticlesService and StorageService (direction: documents → articles).
 */
@Module({
  imports: [ArticlesModule, StorageModule],
  controllers: [DocumentsController, ArticleAttachmentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
