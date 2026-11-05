import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CategoriesService } from './categories.service';
import { KnowledgeBasesController } from './knowledge-bases.controller';
import { KnowledgeBasesService } from './knowledge-bases.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService, CategoriesService],
  exports: [KnowledgeBasesService, CategoriesService],
})
export class KnowledgeBasesModule {}
