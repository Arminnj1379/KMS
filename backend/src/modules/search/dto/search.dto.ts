import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ description: 'Keyword or phrase (min 2 chars)', minLength: 2, maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  q!: string;

  @ApiPropertyOptional({ enum: ['draft', 'in_review', 'published', 'archived'] })
  @IsOptional()
  @IsIn(['draft', 'in_review', 'published', 'archived'])
  status?: string;

  @ApiPropertyOptional({ description: 'Restrict to one KB (id or slug)' })
  @IsOptional()
  @IsString()
  kbId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;

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
  @Max(50)
  pageSize = 20;

  @ApiPropertyOptional({ enum: ['relevance', 'newest', 'updated'], default: 'relevance' })
  @IsOptional()
  @IsIn(['relevance', 'newest', 'updated'])
  sort: 'relevance' | 'newest' | 'updated' = 'relevance';
}
