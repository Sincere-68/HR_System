import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentConversionType, JobLevelCode } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateEmploymentConversionDto {
  @ApiProperty({ enum: EmploymentConversionType })
  @IsEnum(EmploymentConversionType)
  type: EmploymentConversionType;

  @ApiProperty({ description: '员工主档 ID' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  employeeId: string;

  @ApiProperty({ description: '源任职周期 ID' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  sourceEmploymentPeriodId: string;

  @ApiProperty({ description: '目标组织 ID' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  targetOrganizationId: string;

  @ApiPropertyOptional({ description: '目标职位 ID' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  targetPositionId?: string;

  @ApiPropertyOptional({ description: '目标职务 ID' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  targetJobTitleId?: string;

  @ApiPropertyOptional({ enum: JobLevelCode, description: '目标职级' })
  @IsOptional()
  @IsEnum(JobLevelCode)
  targetJobLevel?: JobLevelCode;

  @ApiProperty({ description: '计划生效日期，格式 YYYY-MM-DD' })
  @IsDateString({ strict: true })
  plannedEffectiveDate: string;
}
