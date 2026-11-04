import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { KnowledgeBasesController } from './knowledge-bases.controller';
import { KnowledgeBasesService } from './knowledge-bases.service';

@Module({
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService, CategoriesService],
  exports: [KnowledgeBasesService, CategoriesService],
})
export class KnowledgeBasesModule {}
