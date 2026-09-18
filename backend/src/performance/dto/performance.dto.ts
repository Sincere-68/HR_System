import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsDefined, IsEnum, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { PerformanceCyclePeriodType, PerformanceExceptionHandlerType, PerformanceTemplateSourceType, PerformanceWorkflowAction, ProcessStatus } from '@prisma/client';

export class ParsePerformanceTemplateDto {
  @ApiProperty({ description: '原始 Markdown' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000_000)
  sourceMarkdown!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  sourceName?: string;
}

export class PerformanceTemplateDefinitionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: Object })
  @IsDefined()
  @IsObject()
  definition!: Record<string, unknown>;
}

export class CreatePerformanceTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  name!: string;

  @ApiProperty({ enum: PerformanceTemplateSourceType })
  @IsEnum(PerformanceTemplateSourceType)
  sourceType!: PerformanceTemplateSourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Markdown 来源文件名；手动配置模板不传' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  sourceName?: string;

  @ApiPropertyOptional({ description: 'Markdown 原文；sourceType=MARKDOWN 时必填' })
  @IsOptional()
  @IsString()
  @MaxLength(1_000_000)
  sourceMarkdown?: string;

  @ApiProperty({ type: Object })
  @IsDefined()
  @IsObject()
  definition!: Record<string, unknown>;
}

export class CreatePerformanceCycleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty()
  @IsBoolean()
  isPublic!: boolean;

  @ApiProperty()
  @IsBoolean()
  linkedLevel!: boolean;

  @ApiProperty({ minimum: 2000, maximum: 9999 })
  @IsInt()
  @Min(2000)
  @Max(9999)
  year!: number;

  @ApiProperty({ enum: PerformanceCyclePeriodType })
  @IsEnum(PerformanceCyclePeriodType)
  periodType!: PerformanceCyclePeriodType;

  @ApiProperty({ description: '周期开始日期 YYYY-MM-DD' })
  @IsDateString({ strict: true })
  periodStart!: string;

  @ApiProperty({ description: '周期结束日期 YYYY-MM-DD' })
  @IsDateString({ strict: true })
  periodEnd!: string;

  @ApiPropertyOptional({ description: '可选已发布绩效模板版本 ID；也可在添加被考核人时指定模板' })
  @IsOptional()
  @IsString()
  templateVersionId?: string;

  @ApiProperty({ enum: PerformanceExceptionHandlerType })
  @IsEnum(PerformanceExceptionHandlerType)
  exceptionHandlerType!: PerformanceExceptionHandlerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exceptionHandlerEmployeeId?: string;

  @ApiProperty()
  @IsBoolean()
  lockRelation!: boolean;

  /** @deprecated Participants are derived from organizationId by the server. */
  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employeeIds?: string[];
}

export class PerformanceCycleParticipantsActionDto {
  @ApiProperty({ type: [String], description: '当前绩效活动中选中的被考核人 ID' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  employeeIds!: string[];
}

export class AddPerformanceCycleParticipantsDto {
  @ApiProperty({ description: '要加入活动的员工 ID；每次添加仅绑定一名人员与一份模板' })
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @ApiProperty({ description: '该被考核人的已发布绩效模板版本 ID' })
  @IsString()
  @IsNotEmpty()
  templateVersionId!: string;
}

export class UpdatePerformanceCycleParticipantTemplateDto {
  @ApiProperty({ description: '已发布绩效模板版本 ID' })
  @IsString()
  @IsNotEmpty()
  templateVersionId!: string;
}

export class ArchivePerformanceTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  reason?: string;
}

export class ArchivePerformanceCycleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  reason?: string;
}

export class PerformanceTaskSubmissionDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  adjustment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  comment?: string;

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];
}

export class PerformanceWorkflowTaskSubmissionDto {
  @ApiProperty({ enum: PerformanceWorkflowAction })
  @IsEnum(PerformanceWorkflowAction)
  action!: PerformanceWorkflowAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  comment?: string;
}

export class ModifyPerformanceResultDto {
  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  finalScore!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  reason!: string;
}

export class CreateEmployeePerformanceAmountBaseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @ApiProperty()
  @IsDateString()
  effectiveAt!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  reason!: string;
}

export class CreateCycleParticipantAmountBaseDto {
  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @ApiProperty()
  @IsDateString()
  effectiveAt!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  reason!: string;
}

export class QueryEmployeePerformanceAmountBaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}

export class QueryPerformanceDto {
  @ApiPropertyOptional({ enum: ProcessStatus })
  @IsOptional()
  @IsEnum(ProcessStatus)
  status?: ProcessStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
