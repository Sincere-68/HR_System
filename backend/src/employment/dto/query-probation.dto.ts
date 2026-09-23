import { ProcessStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

  @ApiPropertyOptional({ description: '任职部门 ID，包含下级部门' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  organizationId?: string;

  @ApiPropertyOptional({ description: '试用期月数' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  probationMonths?: number;

  @ApiPropertyOptional({ description: '即将到期视图的到期天数，默认 30 天' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiresWithinDays?: number;

  @ApiPropertyOptional({ description: '试用流程状态', enum: ProcessStatus })
  @IsOptional()
  @IsEnum(ProcessStatus)
  status?: ProcessStatus;

  @ApiPropertyOptional({ description: '试用开始日期起（含）' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '试用开始日期必须为 YYYY-MM-DD' })
  startDateFrom?: string;

  @ApiPropertyOptional({ description: '试用开始日期止（含）' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '试用开始日期必须为 YYYY-MM-DD' })
  startDateTo?: string;

  @ApiPropertyOptional({ description: '预计结束日期起（含）' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '预计结束日期必须为 YYYY-MM-DD' })
  plannedEndDateFrom?: string;

  @ApiPropertyOptional({ description: '预计结束日期止（含）' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '预计结束日期必须为 YYYY-MM-DD' })
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
