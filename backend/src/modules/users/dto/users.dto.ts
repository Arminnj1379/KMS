import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { OrgRole } from '../../../common/auth/types';

export class InviteUserDto {
  @ApiProperty({ example: 'newhire@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'کاربر جدید' })
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'Secret123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'گذرواژه باید حداقل شامل یک حرف و یک عدد باشد',
  })
  password!: string;

  @ApiProperty({ enum: ['org-admin', 'member'], default: 'member' })
  @IsIn(['org-admin', 'member'])
  role: OrgRole = 'member';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['org-admin', 'member'] })
  @IsOptional()
  @IsIn(['org-admin', 'member'])
  role?: OrgRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string | null;
}

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: ['fa', 'en'] })
  @IsOptional()
  @IsIn(['fa', 'en'])
  locale?: string;
}

export class ListUsersQuery {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
