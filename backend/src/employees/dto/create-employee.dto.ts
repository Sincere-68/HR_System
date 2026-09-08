import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BankName,
  EducationLevel,
  EmploymentStatus,
  EmploymentRelationship,
  Ethnicity,
  Gender,
  HouseholdType,
  IdentityDocumentType,
  InstitutionType,
  JobLevelCode,
  MaritalStatus,
  PersonnelCategory,
  PersonnelPosition,
  PersonnelSource,
  PoliticalStatus,
  EmployeeLevel,
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
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const CONTRACT_TERM_TYPES = ['FIXED', 'OPEN_ENDED'] as const;

export class CreateEmployeeDto {
  @ApiProperty({ example: 'FAKE-1005' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: '工号只能包含字母、数字、下划线和连字符' })
  employeeNo: string;

  @ApiProperty({ example: '虚构员工甲' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'fictional.employee@example.invalid' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(191)
  workEmail: string;

  @ApiProperty({ example: 'fictional.personal@example.invalid' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(191)
  personalEmail: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ enum: PersonnelCategory })
  @IsEnum(PersonnelCategory)
  personnelCategory: PersonnelCategory;

  @ApiProperty({ enum: EmploymentRelationship })
  @IsEnum(EmploymentRelationship)
  employmentRelationship: EmploymentRelationship;

  @ApiProperty({ enum: PersonnelSource })
  @IsEnum(PersonnelSource)
  personnelSource: PersonnelSource;

  @ApiProperty({ enum: WorkArrangement })
  @IsEnum(WorkArrangement)
  workArrangement: WorkArrangement;

  @ApiProperty({ example: '13900001005' })
  @Transform(trim)
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号必须为 11 位中国大陆手机号' })
  mobile: string;

  @ApiProperty({ enum: IdentityDocumentType, example: IdentityDocumentType.NATIONAL_ID })
  @IsEnum(IdentityDocumentType)
  documentType: IdentityDocumentType;

  @ApiProperty({ example: '110101200001015001' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  documentNumber: string;

  @ApiProperty({ example: '2036-08-25', description: '证件截止日期，格式 YYYY-MM-DD' })
  @IsDateString({ strict: true })
  documentExpiryDate: string;

  @ApiProperty({ example: '2026-08-25', description: '入职日期，格式 YYYY-MM-DD' })
  @IsDateString({ strict: true })
  entryDate: string;

  @ApiProperty({ description: '主要部门 ID' })
  @IsString()
  organizationId: string;

  @ApiPropertyOptional({ description: '职位 ID' })
  @IsOptional()
  @IsString()
  positionId?: string;

  @ApiPropertyOptional({ enum: JobLevelCode, description: '职级固定 code' })
  @IsOptional()
  @IsEnum(JobLevelCode)
  jobLevel?: JobLevelCode;

  @ApiPropertyOptional({ description: '工作地点（自由文本）', maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  workplaceName?: string;

  @ApiProperty({ enum: PersonnelPosition })
  @IsEnum(PersonnelPosition)
  personnelPosition: PersonnelPosition;

  @ApiProperty({ enum: EmployeeLevel })
  @IsEnum(EmployeeLevel)
  employeeLevel: EmployeeLevel;

  @ApiProperty({ description: '本次新增时创建的合同协议全日制公司目录 ID' })
  @IsString()
  agreementEmployingCompanyId: string;

  @ApiPropertyOptional({ description: '籍贯完整中文行政区划层级，例如“湖北省 / 武汉市 / 洪山区”', maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  nativePlaceRegionName?: string;

  @ApiProperty({ enum: HouseholdType })
  @IsEnum(HouseholdType)
  householdType: HouseholdType;

  @ApiPropertyOptional({ description: '户籍所在地完整中文行政区划层级', maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  householdRegionName?: string;

  @ApiPropertyOptional({ description: '联系地址完整中文行政区划层级', maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  residentialRegionName?: string;

  @ApiProperty({ enum: BankName })
  @IsEnum(BankName)
  bankName: BankName;

  @ApiProperty({ maxLength: 191 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  bankBranchName: string;

  @ApiProperty({ maxLength: 19 })
  @Transform(trim)
  @Matches(/^\d{1,19}$/, { message: '银行账号必须为 1 至 19 位数字' })
  bankAccountNumber: string;

  @ApiProperty({ description: '出生日期，格式 YYYY-MM-DD' })
  @IsDateString({ strict: true })
  birthDate: string;

  @ApiProperty({ enum: Ethnicity })
  @IsEnum(Ethnicity)
  ethnicity: Ethnicity;

  @ApiProperty({ enum: MaritalStatus })
  @IsEnum(MaritalStatus)
  maritalStatus: MaritalStatus;

  @ApiProperty({ enum: PoliticalStatus })
  @IsEnum(PoliticalStatus)
  politicalStatus: PoliticalStatus;

  @ApiProperty({ maxLength: 191 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  graduationSchoolName: string;

  @ApiProperty({ enum: InstitutionType })
  @IsEnum(InstitutionType)
  institutionType: InstitutionType;

  @ApiProperty({ enum: EducationLevel })
  @IsEnum(EducationLevel)
  highestEducation: EducationLevel;

  @ApiProperty({ description: '毕业日期，格式 YYYY-MM-DD' })
  @IsDateString({ strict: true })
  graduationDate: string;

  @ApiProperty({ maxLength: 191 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  major: string;

  @ApiProperty({ description: '是否有试用期' })
  @IsBoolean()
  hasProbation: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  probationMonths?: number;

  @ApiPropertyOptional({ description: '预计试用结束日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  probationEndDate?: string;

  @ApiPropertyOptional({ description: '直接经理员工 ID' })
  @IsOptional()
  @IsString()
  managerEmployeeId?: string;

  @ApiProperty({ enum: CONTRACT_TERM_TYPES, description: '本次新增时创建的合同协议期限类型' })
  @IsIn(CONTRACT_TERM_TYPES)
  contractTermType: 'FIXED' | 'OPEN_ENDED';

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

  @ApiProperty({ maxLength: 191 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  householdAddress: string;

  @ApiProperty({ maxLength: 191 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  residentialAddress: string;

  @ApiProperty({ maxLength: 191 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  emergencyContactName: string;

  @ApiProperty({ maxLength: 191 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  emergencyContactRelationship: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  emergencyContactMobile: string;

  @ApiProperty({ enum: EmploymentStatus, example: EmploymentStatus.REGULAR })
  @IsEnum(EmploymentStatus)
  employmentStatus: EmploymentStatus;
}
