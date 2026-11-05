import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * Permission-scoped cross-KB search (ARCHITECTURE §9). Thin façade over
 * `ArticlesService.globalSearch` (direction: search → articles → kbs);
 * swapping in Elasticsearch/Atlas later touches only the service.
 */
@Module({
  imports: [ArticlesModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
