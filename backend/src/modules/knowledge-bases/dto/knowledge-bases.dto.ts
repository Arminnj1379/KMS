import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const KB_VISIBILITIES = ['private', 'internal', 'public'] as const;
export type KbVisibility = (typeof KB_VISIBILITIES)[number];

export const KB_ROLES = ['manager', 'contributor', 'reviewer', 'reader'] as const;
export type KbRoleName = (typeof KB_ROLES)[number];

export class CreateKnowledgeBaseDto {
  @ApiProperty({ example: 'راهنمای پشتیبانی' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ example: 'support-guide' })
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'شناسه باید لاتین، کوچک و خط‌تیره‌دار باشد' })
  @MaxLength(80)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  icon?: string;

  @ApiPropertyOptional({ enum: KB_VISIBILITIES, default: 'internal' })
  @IsOptional()
  @IsIn([...KB_VISIBILITIES])
  visibility?: KbVisibility;
}

export class UpdateKnowledgeBaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  icon?: string;

  @ApiPropertyOptional({ enum: KB_VISIBILITIES })
  @IsOptional()
  @IsIn([...KB_VISIBILITIES])
  visibility?: KbVisibility;
}

export class AddKbMemberDto {
  @ApiProperty({ example: 'hamkar@example.com' })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ enum: KB_ROLES, default: 'reader' })
  @IsIn([...KB_ROLES])
  role: KbRoleName = 'reader';
}

export class UpdateKbMemberDto {
  @ApiProperty({ enum: KB_ROLES })
  @IsIn([...KB_ROLES])
  role!: KbRoleName;
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'شروع کار' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ example: 'getting-started' })
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'شناسه باید لاتین، کوچک و خط‌تیره‌دار باشد' })
  @MaxLength(80)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'null = move to root' })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
