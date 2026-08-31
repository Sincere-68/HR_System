import { ProcessStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class QueryEmployeeMovementsDto {
  @ApiPropertyOptional({ description: '页面口径：异动中、已完成或全部', enum: ['active', 'completed', 'all'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'completed', 'all'])
  view: 'active' | 'completed' | 'all' = 'active';

  @ApiPropertyOptional({ description: '员工姓名或工号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  keyword?: string;

  @ApiPropertyOptional({ description: '关联审批流程状态；未关联审批的异动不会被此筛选命中', enum: ProcessStatus })
  @IsOptional()
  @IsEnum(ProcessStatus)
  approvalStatus?: ProcessStatus;

  @ApiPropertyOptional({ description: '异动生效日期起（含）' })
  @IsOptional()
  @IsDateString()
  effectiveDateFrom?: string;

  @ApiPropertyOptional({ description: '异动生效日期止（含）' })
  @IsOptional()
  @IsDateString()
  effectiveDateTo?: string;

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
