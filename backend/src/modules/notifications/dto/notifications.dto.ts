import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query for `GET /notifications` (own inbox, newest first). */
export class ListNotificationsQuery {
  @ApiPropertyOptional({ description: 'Filter by read state' })
  @IsOptional()
  @Type(() => String)
  isRead?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  /** Accepts `?isRead=true|false`; undefined = all. */
  readFilter(): boolean | undefined {
    if (this.isRead === 'true') return true;
    if (this.isRead === 'false') return false;
    return undefined;
  }
}
