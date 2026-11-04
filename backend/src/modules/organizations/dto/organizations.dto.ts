import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { OrgRole } from '../../../common/auth/types';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'فناوری اطلاعات' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'it' })
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'شناسه باید لاتین، کوچک و خط‌تیره‌دار باشد' })
  @MaxLength(80)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'null = move to root' })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class AddMemberDto {
  @ApiProperty({ example: 'hamkar@example.com' })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ enum: ['org-admin', 'member'], default: 'member' })
  @IsIn(['org-admin', 'member'])
  role: OrgRole = 'member';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: ['org-admin', 'member'] })
  @IsOptional()
  @IsIn(['org-admin', 'member'])
  role?: OrgRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string | null;
}
