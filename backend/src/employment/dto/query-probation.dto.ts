import { ProcessStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryProbationDto {
  @ApiPropertyOptional({
    description: '页面口径：30 天内到期、考核中、转正审批中、全部或已转正',
    enum: ['expiring', 'reviewing', 'approval', 'all', 'completed'],
    default: 'expiring',
  })
  @IsOptional()
  @IsIn(['expiring', 'reviewing', 'approval', 'all', 'completed'])
  view: 'expiring' | 'reviewing' | 'approval' | 'all' | 'completed' = 'expiring';

  @ApiPropertyOptional({ description: '员工姓名或工号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;

  @ApiPropertyOptional({ description: '试用流程状态', enum: ProcessStatus })
  @IsOptional()
  @IsEnum(ProcessStatus)
  status?: ProcessStatus;

  @ApiPropertyOptional({ description: '试用开始日期起（含）' })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({ description: '试用开始日期止（含）' })
  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @ApiPropertyOptional({ description: '预计结束日期起（含）' })
  @IsOptional()
  @IsDateString()
  plannedEndDateFrom?: string;

  @ApiPropertyOptional({ description: '预计结束日期止（含）' })
  @IsOptional()
  @IsDateString()
  plannedEndDateTo?: string;

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
