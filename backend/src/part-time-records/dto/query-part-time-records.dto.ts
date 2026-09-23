import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PartTimeRecordStatus } from '@prisma/client';

export class QueryPartTimeRecordsDto {
  @ApiPropertyOptional({ enum: PartTimeRecordStatus })
  @IsOptional()
  @IsEnum(PartTimeRecordStatus)
  status?: PartTimeRecordStatus;

  @ApiPropertyOptional({ description: '员工 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  employeeId?: string;

  @ApiPropertyOptional({ description: '员工姓名或工号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;

  @ApiPropertyOptional({ description: '职责部门 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  organizationId?: string;

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
