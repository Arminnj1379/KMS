import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

export class SubmitReviewDto {
  @ApiProperty({ description: 'KB member (reviewer/manager role) assigned to review' })
  @IsString()
  @IsNotEmpty()
  reviewerId!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class DecideReviewDto {
  @ApiPropertyOptional({ description: 'Decision note (stored on history + request)', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class InboxQuery {
  @ApiPropertyOptional({ enum: ['reviewer', 'requester'], default: 'reviewer' })
  @IsOptional()
  @IsIn(['reviewer', 'requester'])
  role: 'reviewer' | 'requester' = 'reviewer';

  @ApiPropertyOptional({ enum: REVIEW_STATUSES })
  @IsOptional()
  @IsIn([...REVIEW_STATUSES])
  status?: string;

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
}
