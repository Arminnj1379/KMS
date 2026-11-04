import { Module } from '@nestjs/common';
import { ArticleVersionsController } from './article-versions.controller';
import { ArticleVersionsService } from './article-versions.service';
import { ArticlesModule } from '../articles/articles.module';

@Module({
  imports: [ArticlesModule],
  controllers: [ArticleVersionsController],
  providers: [ArticleVersionsService],
  exports: [ArticleVersionsService],
})
export class ArticleVersionsModule {}
