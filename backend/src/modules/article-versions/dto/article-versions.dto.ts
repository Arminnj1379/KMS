import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSnapshotDto {
  @ApiPropertyOptional({ description: 'Optional note stored with the immutable snapshot', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  changelog?: string;
}

export class RestoreVersionDto {
  @ApiPropertyOptional({ description: 'Optional note; defaults to «restored from version N»', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  changelog?: string;
}

export class DiffQuery {
  @ApiPropertyOptional({ description: 'Target version to compare against' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  to!: number;
}
