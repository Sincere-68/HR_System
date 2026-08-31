import { AssignmentStatus, EmploymentStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryEmploymentRecordsDto {
  @ApiPropertyOptional({ enum: ['current', 'history'], default: 'current' })
  @IsOptional()
  @IsEnum(['current', 'history'])
  view: 'current' | 'history' = 'current';

  @ApiPropertyOptional({ description: '员工姓名或工号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  keyword?: string;

  @ApiPropertyOptional({ description: '部门 ID；包含该部门及所有下级组织' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  organizationId?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus, description: '人员状态（EmploymentRecord.status）' })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  personnelStatus?: EmploymentStatus;

  @ApiPropertyOptional({ enum: AssignmentStatus, description: '任职状态（EmployeeAssignment.status）' })
  @IsOptional()
  @IsEnum(AssignmentStatus)
  assignmentStatus?: AssignmentStatus;

  @ApiPropertyOptional({ description: '现岗位开始日期起（含）' })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({ description: '现岗位开始日期止（含）' })
  @IsOptional()
  @IsDateString()
  startDateTo?: string;

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
