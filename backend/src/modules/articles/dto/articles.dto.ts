import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateArticleDto {
  @ApiProperty({ example: 'راهنمای شروع' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'getting-started' })
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'شناسه باید لاتین، کوچک و خط‌تیره‌دار باشد' })
  @MaxLength(120)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiProperty({ description: 'Tiptap document (type: doc)' })
  @IsObject()
  contentJson!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Plain text; derived server-side when omitted' })
  @IsOptional()
  @IsString()
  contentText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tagNames?: string[];
}

export class UpdateArticleDto {
  /** Last seen version — mismatch yields 409 with the current document. */
  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @ApiPropertyOptional({ description: 'Tiptap document (type: doc)' })
  @IsOptional()
  @IsObject()
  contentJson?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentText?: string;

  @ApiPropertyOptional({ description: 'null = uncategorized' })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({
    description: 'Changelog for an explicit named version (stores an immutable snapshot)',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  changelog?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tagNames?: string[];
}

export class ListArticlesQuery {
  @ApiPropertyOptional({ enum: ['draft', 'in_review', 'published', 'archived'] })
  @IsOptional()
  @IsIn(['draft', 'in_review', 'published', 'archived'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  includeSubtree?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorId?: string;

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

  @ApiPropertyOptional({ enum: ['newest', 'updated', 'title'], default: 'newest' })
  @IsOptional()
  @IsIn(['newest', 'updated', 'title'])
  sort: 'newest' | 'updated' | 'title' = 'newest';
}
