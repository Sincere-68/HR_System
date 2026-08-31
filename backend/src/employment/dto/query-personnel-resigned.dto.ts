import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Query parameters for the personnel-page completed-resignation read model. */
export class QueryPersonnelResignedDto {
  @ApiPropertyOptional({ description: '员工姓名或工号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  keyword?: string;

  @ApiPropertyOptional({ description: '最后工作日起（含）；实际日期优先，否则使用计划日期' })
  @IsOptional()
  @IsDateString()
  lastWorkingDateFrom?: string;

  @ApiPropertyOptional({ description: '最后工作日至（含）；实际日期优先，否则使用计划日期' })
  @IsOptional()
  @IsDateString()
  lastWorkingDateTo?: string;

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
