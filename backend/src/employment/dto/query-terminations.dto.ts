import { ProcessStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class QueryTerminationsDto {
  @ApiPropertyOptional({ description: '页面口径：办理中、已完成或全部', enum: ['active', 'completed', 'all'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'completed', 'all'])
  view: 'active' | 'completed' | 'all' = 'active';

  @ApiPropertyOptional({ description: '员工姓名或工号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  keyword?: string;

  @ApiPropertyOptional({ description: '离职记录业务状态', enum: ProcessStatus })
  @IsOptional()
  @IsEnum(ProcessStatus)
  status?: ProcessStatus;

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
