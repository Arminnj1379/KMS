import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { KnowledgeBasesModule } from '../knowledge-bases/knowledge-bases.module';

@Module({
  imports: [KnowledgeBasesModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
