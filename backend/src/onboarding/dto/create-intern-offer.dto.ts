import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AgreementType,
  EducationLevel,
  EmployeeLevel,
  Gender,
  IdentityDocumentType,
  JobLevelCode,
  PersonnelCategory,
  PersonnelSource,
  WorkArrangement,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DECIMAL_STRING = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const CONTRACT_TERM_TYPES = ['FIXED', 'OPEN_ENDED'] as const;

class CandidateIdentityDocumentDto {
  @ApiProperty({ enum: IdentityDocumentType })
  @IsEnum(IdentityDocumentType)
  documentType: IdentityDocumentType;

  @ApiProperty({ maxLength: 64 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  documentNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: '证件截止日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  expiryDate?: string;
}

class CandidateEducationExperienceDto {
  @ApiProperty({ maxLength: 191 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  schoolName: string;

  @ApiProperty({ enum: EducationLevel })
  @IsEnum(EducationLevel)
  educationLevel: EducationLevel;

  @ApiPropertyOptional({ maxLength: 191 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  major?: string;

  @ApiPropertyOptional({ description: '毕业日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  graduationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isHighestEducation?: boolean;
}

class OfferCompensationSnapshotDto {
  @ApiPropertyOptional({ maxLength: 191 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  salaryPackage?: string;

  @ApiPropertyOptional({ maxLength: 10000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  salaryRemark?: string;

  @ApiPropertyOptional({ description: '非负金额小数字符串，最多两位小数' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: '金额必须为非负且最多两位小数的数字字符串' })
  preConfirmationBaseSalary?: string;

  @ApiPropertyOptional({ description: '非负金额小数字符串，最多两位小数' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: '金额必须为非负且最多两位小数的数字字符串' })
  postConfirmationBaseSalary?: string;

  @ApiPropertyOptional({ description: '非负金额小数字符串，最多两位小数' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: '金额必须为非负且最多两位小数的数字字符串' })
  preConfirmationMonthlyPerformance?: string;

  @ApiPropertyOptional({ description: '非负金额小数字符串，最多两位小数' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: '金额必须为非负且最多两位小数的数字字符串' })
  postConfirmationMonthlyPerformance?: string;

  @ApiPropertyOptional({ description: '非负金额小数字符串，最多两位小数' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: '金额必须为非负且最多两位小数的数字字符串' })
  preConfirmationMonthlyManagementPerformance?: string;

  @ApiPropertyOptional({ description: '非负金额小数字符串，最多两位小数' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: '金额必须为非负且最多两位小数的数字字符串' })
  postConfirmationMonthlyManagementPerformance?: string;

  @ApiPropertyOptional({ description: '非负金额小数字符串，最多两位小数' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: '金额必须为非负且最多两位小数的数字字符串' })
  fullTimeContractSalary?: string;

  @ApiPropertyOptional({ description: '非负金额小数字符串，最多两位小数' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: '金额必须为非负且最多两位小数的数字字符串' })
  annualPerformance?: string;
}

class OfferPartTimeSnapshotDto {
  @ApiPropertyOptional({ maxLength: 191 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  positionName?: string;

  @ApiPropertyOptional({ description: '非负时薪小数字符串，最多两位小数' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: '时薪必须为非负且最多两位小数的数字字符串' })
  hourlyRate?: string;
}

/** Typed candidate and proposed-offer snapshots for a new internship Offer. */
export class CreateInternOfferDto {
  @ApiProperty({ example: '虚构实习候选人' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: '13900001001', description: '11 位中国大陆手机号；不传 +86' })
  @Transform(trim)
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号必须为 11 位中国大陆手机号' })
  mobile: string;

  @ApiProperty({ example: 'fictional.intern@example.invalid' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(191)
  personalEmail: string;

  @ApiProperty({ enum: PersonnelSource })
  @IsEnum(PersonnelSource)
  source: PersonnelSource;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: '出生日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string;

  @ApiPropertyOptional({ description: '参加工作日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  workStartDate?: string;

  @ApiPropertyOptional({ type: CandidateIdentityDocumentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateIdentityDocumentDto)
  identityDocument?: CandidateIdentityDocumentDto;

  @ApiPropertyOptional({ type: CandidateEducationExperienceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateEducationExperienceDto)
  educationExperience?: CandidateEducationExperienceDto;

  @ApiProperty({ description: '录用部门 ID' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  organizationId: string;

  @ApiProperty({ description: '录用职位 ID' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  positionId: string;

  @ApiPropertyOptional({ description: '工作地点 ID；未选择时 Offer 快照保存为空' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  workplaceId?: string;

  @ApiProperty({ example: '2026-09-01', description: '拟入职日期，格式 YYYY-MM-DD' })
  @IsDateString({ strict: true })
  proposedEntryDate: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  probationMonths?: number;

  @ApiPropertyOptional({ enum: JobLevelCode })
  @IsOptional()
  @IsEnum(JobLevelCode)
  jobLevel?: JobLevelCode;

  @ApiPropertyOptional({ enum: EmployeeLevel })
  @IsOptional()
  @IsEnum(EmployeeLevel)
  employeeLevel?: EmployeeLevel;

  @ApiPropertyOptional({ enum: PersonnelCategory })
  @IsOptional()
  @IsEnum(PersonnelCategory)
  personnelCategory?: PersonnelCategory;

  @ApiPropertyOptional({ enum: WorkArrangement })
  @IsOptional()
  @IsEnum(WorkArrangement)
  workArrangement?: WorkArrangement;

  @ApiPropertyOptional({ description: 'Offer 快照直线经理员工 ID' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  directManagerEmployeeId?: string;

  @ApiPropertyOptional({ description: 'Offer 快照全日制公司目录 ID' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  employingCompanyId?: string;

  @ApiPropertyOptional({ enum: AgreementType })
  @IsOptional()
  @IsEnum(AgreementType)
  agreementType?: AgreementType;

  @ApiPropertyOptional({ enum: CONTRACT_TERM_TYPES })
  @IsOptional()
  @IsIn(CONTRACT_TERM_TYPES)
  contractTermType?: 'FIXED' | 'OPEN_ENDED';

  @ApiPropertyOptional({ minimum: 1, maximum: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  contractMonths?: number;

  @ApiPropertyOptional({ description: '合同终止日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  contractEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSeparatelySigned?: boolean;

  @ApiPropertyOptional({ type: OfferCompensationSnapshotDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OfferCompensationSnapshotDto)
  compensationSnapshot?: OfferCompensationSnapshotDto;

  @ApiPropertyOptional({ type: OfferPartTimeSnapshotDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OfferPartTimeSnapshotDto)
  partTimeSnapshot?: OfferPartTimeSnapshotDto;
}
