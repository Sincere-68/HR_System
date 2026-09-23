import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePartTimeRecordDto {
  @ApiProperty({ description: '员工 ID' })
  @IsString()
  @MaxLength(191)
  employeeId!: string;

  @ApiProperty({ description: '兼职类型' })
  @IsString()
  @MaxLength(64)
  type!: string;

  @ApiPropertyOptional({ nullable: true, description: '兼职机构' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  institution?: string | null;

  @ApiProperty({ description: '兼职职责部门 ID' })
  @IsString()
  @MaxLength(191)
  organizationId!: string;

  @ApiPropertyOptional({ nullable: true, description: '兼职职务 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  jobTitleId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: '兼职直线经理员工 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  managerEmployeeId?: string | null;

  @ApiProperty({ description: '兼职开始日期，Asia/Shanghai 日历日' })
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '兼职开始日期必须为 YYYY-MM-DD' })
  startDate!: string;

  @ApiPropertyOptional({ nullable: true, description: '兼职结束日期，Asia/Shanghai 日历日' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '兼职结束日期必须为 YYYY-MM-DD' })
  endDate?: string | null;
}
