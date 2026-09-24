import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentApplicationStatus, EmploymentConversionType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class QueryEmploymentConversionsDto {
  @ApiPropertyOptional({ enum: ['in_progress', 'completed', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['in_progress', 'completed', 'all'])
  view?: 'in_progress' | 'completed' | 'all';

  @ApiPropertyOptional({ enum: EmploymentApplicationStatus })
  @IsOptional()
  @IsEnum(EmploymentApplicationStatus)
  status?: EmploymentApplicationStatus;

  @ApiPropertyOptional({ enum: EmploymentConversionType })
  @IsOptional()
  @IsEnum(EmploymentConversionType)
  type?: EmploymentConversionType;

  @ApiPropertyOptional({ description: '员工姓名或工号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  keyword?: string;

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
