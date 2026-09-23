import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentApplicationStatus, EmploymentConversionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryEmploymentConversionsDto {
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
