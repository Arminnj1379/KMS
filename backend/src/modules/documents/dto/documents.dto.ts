import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OBJECT_KEY_PATTERN } from '../documents.constants';

export class UploadIntentDto {
  @ApiProperty({ example: 'contract.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  filename!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  mime!: string;

  @ApiProperty({ example: 102400 })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class ConfirmDocumentDto {
  @ApiProperty({ description: 'Server-issued key returned by upload-intent' })
  @IsString()
  @Matches(OBJECT_KEY_PATTERN, { message: 'کلید فایل معتبر نیست' })
  objectKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  filename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  mime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;

  @ApiPropertyOptional({ description: 'Attach to this article on confirm (requires kbId)' })
  @IsOptional()
  @IsString()
  kbId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  articleId?: string;
}

export class AttachExistingDto {
  @ApiProperty({ description: 'Id of an organization document to attach' })
  @IsString()
  @IsNotEmpty()
  documentId!: string;
}

export class ListDocumentsQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

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
