import { ProcessStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PERSONNEL_TRANSFER_FORMATS,
  PROBATION_EXPORT_FIELDS,
  type ProbationExportFieldKey,
} from '@hr-demo/shared';

const probationExportFieldKeys = PROBATION_EXPORT_FIELDS.map(({ key }) => key);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class ProbationExportQueryDto {
  @ApiPropertyOptional({
    enum: ['expiring', 'reviewing', 'approval', 'all', 'completed'],
    default: 'expiring',
  })
  @IsOptional()
  @IsIn(['expiring', 'reviewing', 'approval', 'all', 'completed'])
  view?: 'expiring' | 'reviewing' | 'approval' | 'all' | 'completed';

  @ApiPropertyOptional({ description: '员工姓名或工号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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

  @ApiPropertyOptional({ description: '即将到期视图的到期天数' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiresWithinDays?: number;

  @ApiPropertyOptional({ enum: ProcessStatus })
  @IsOptional()
  @IsEnum(ProcessStatus)
  status?: ProcessStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '试用开始日期必须为 YYYY-MM-DD' })
  startDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '试用开始日期必须为 YYYY-MM-DD' })
  startDateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '预计结束日期必须为 YYYY-MM-DD' })
  plannedEndDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '预计结束日期必须为 YYYY-MM-DD' })
  plannedEndDateTo?: string;
}

export class ProbationTransferFormatDto {
  @ApiProperty({ enum: PERSONNEL_TRANSFER_FORMATS })
  @IsEnum(PERSONNEL_TRANSFER_FORMATS)
  format: (typeof PERSONNEL_TRANSFER_FORMATS)[number];
}

export class ProbationExportDto {
  @ApiProperty({ enum: PERSONNEL_TRANSFER_FORMATS })
  @IsEnum(PERSONNEL_TRANSFER_FORMATS)
  format: (typeof PERSONNEL_TRANSFER_FORMATS)[number];

  @ApiProperty({ isArray: true, enum: probationExportFieldKeys })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @IsIn(probationExportFieldKeys, { each: true })
  fields: ProbationExportFieldKey[];

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10_000)
  @IsString({ each: true })
  probationIds?: string[];

  @ApiPropertyOptional({ type: ProbationExportQueryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProbationExportQueryDto)
  query?: ProbationExportQueryDto;
}
