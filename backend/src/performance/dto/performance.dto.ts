import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsDefined, IsEnum, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ProcessStatus } from '@prisma/client';

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

export class CreatePerformanceTemplateDto extends ParsePerformanceTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
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

export class CreatePerformanceCycleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  name!: string;

  @ApiProperty({ description: '周期开始日期 YYYY-MM-DD' })
  @IsDateString({ strict: true })
  periodStart!: string;

  @ApiProperty({ description: '周期结束日期 YYYY-MM-DD' })
  @IsDateString({ strict: true })
  periodEnd!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateVersionId!: string;

  @ApiProperty({ isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  employeeIds!: string[];
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

export class UpdatePerformanceAmountBaseDto {
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
