import { ReportingRelationshipType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryReportingRelationshipsDto {
  @ApiPropertyOptional({ enum: ['list', 'graph'], default: 'list' })
  @IsOptional()
  @IsEnum(['list', 'graph'])
  view: 'list' | 'graph' = 'list';

  @ApiPropertyOptional({ description: '已授权员工姓名或工号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  keyword?: string;

  @ApiPropertyOptional({ description: '组织 ID；包含该组织及其下级组织' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  organizationId?: string;

  @ApiPropertyOptional({ enum: ReportingRelationshipType })
  @IsOptional()
  @IsEnum(ReportingRelationshipType)
  relationshipType?: ReportingRelationshipType;

  @ApiPropertyOptional({ default: true, description: 'P0 仅支持主要关系' })
  @IsOptional()
  @Transform(({ value }) => (
    value === 'true' ? true : value === 'false' ? false : value
  ))
  @IsBoolean()
  isPrimary = true;

  @ApiPropertyOptional({ default: false, description: 'P0 不支持虚线关系' })
  @IsOptional()
  @Transform(({ value }) => (
    value === 'true' ? true : value === 'false' ? false : value
  ))
  @IsBoolean()
  includeDotted = false;

  @ApiPropertyOptional({ description: '关系有效业务日，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
