import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EmploymentRelationship, EmploymentStatus } from '@prisma/client';
import { PERSONNEL_FIELDS, PERSONNEL_TRANSFER_FORMATS, type PersonnelTransferFieldKey } from '@hr-demo/shared';

const personnelFieldKeys = PERSONNEL_FIELDS.map(({ key }) => key);

class EmployeeExportQueryDto {
  @ApiPropertyOptional({ description: '姓名或工号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  keyword?: string;

  @ApiPropertyOptional({ description: '姓名关键字（兼容旧导出请求）', deprecated: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;

  @ApiPropertyOptional({ enum: EmploymentRelationship })
  @IsOptional()
  @IsEnum(EmploymentRelationship)
  employmentRelationship?: EmploymentRelationship;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  entryDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  entryDateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lastWorkingDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lastWorkingDateTo?: string;
}

export class EmployeeTransferFormatDto {
  @ApiProperty({ enum: PERSONNEL_TRANSFER_FORMATS })
  @IsEnum(PERSONNEL_TRANSFER_FORMATS)
  format: (typeof PERSONNEL_TRANSFER_FORMATS)[number];
}

export class EmployeeExportDto {
  @ApiProperty({ enum: PERSONNEL_TRANSFER_FORMATS })
  @IsEnum(PERSONNEL_TRANSFER_FORMATS)
  format: (typeof PERSONNEL_TRANSFER_FORMATS)[number];

  @ApiProperty({ isArray: true, enum: personnelFieldKeys })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  fields: PersonnelTransferFieldKey[];

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10_000)
  @IsString({ each: true })
  employeeIds?: string[];

  @ApiPropertyOptional({ type: EmployeeExportQueryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmployeeExportQueryDto)
  query?: EmployeeExportQueryDto;
}
