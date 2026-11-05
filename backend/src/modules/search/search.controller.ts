import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { SearchQueryDto } from './dto/search.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Cross-KB full-text search (permission-scoped, $text + regex fallback)',
  })
  search(@CurrentUser() me: AuthenticatedUser, @Query() query: SearchQueryDto) {
    return this.searchService.search(me.orgId, me.userId, me.orgRole, query);
  }
}
