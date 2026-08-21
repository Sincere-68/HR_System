import { ApiProperty } from '@nestjs/swagger';
import { EmploymentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateEmployeeDto {
  @ApiProperty({ example: 'DEMO-1005' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: '工号只能包含字母、数字、下划线和连字符' })
  employeeNo: string;

  @ApiProperty({ example: '测试员工' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: '13800001005' })
  @Transform(trim)
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号必须为 11 位中国大陆手机号' })
  mobile: string;

  @ApiProperty({ example: '110101199203181021' })
  @Transform(trim)
  @IsString()
  @Matches(/^\d{17}[\dXx]$/, { message: '身份证号格式不正确' })
  idCardNo: string;

  @ApiProperty({ description: '部门 ID' })
  @IsString()
  organizationId: string;

  @ApiProperty({ enum: EmploymentStatus, example: EmploymentStatus.ACTIVE })
  @IsEnum(EmploymentStatus)
  employmentStatus: EmploymentStatus;
}
