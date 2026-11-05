import { Injectable } from '@nestjs/common';
import { ArticlesService } from '../articles/articles.service';
import { SearchQueryDto } from './dto/search.dto';

/**
 * Swap-ready search façade (ARCHITECTURE §9). This MVP implementation is
 * the Mongo provider (`MongoSearchService` behavior): `$text` + regex
 * fallback lives in `ArticlesService.globalSearch`; this service only
 * adapts the HTTP DTO. Elasticsearch/Atlas later = a new provider behind
 * this same API with zero controller changes.
 * Depends on ArticlesService (direction: search → articles → kbs).
 */
@Injectable()
export class SearchService {
  constructor(private readonly articles: ArticlesService) {}

  search(orgId: string, userId: string, orgRole: string, query: SearchQueryDto) {
    return this.articles.globalSearch(orgId, userId, orgRole, {
      q: query.q,
      status: query.status,
      kbId: query.kbId,
      tag: query.tag,
      page: query.page,
      pageSize: query.pageSize,
      sort: query.sort,
    });
  }
}
