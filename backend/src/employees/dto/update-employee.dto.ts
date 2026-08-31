import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BankName,
  EducationLevel,
  EmploymentRelationship,
  Ethnicity,
  Gender,
  HouseholdType,
  IdentityDocumentType,
  InstitutionType,
  MaritalStatus,
  PersonnelCategory,
  PersonnelPosition,
  PersonnelSource,
  PoliticalStatus,
  EmployeeLevel,
  WorkArrangement,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'DEMO-1005' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: '工号只能包含字母、数字、下划线和连字符' })
  employeeNo?: string;

  @ApiPropertyOptional({ example: '测试员工' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(191)
  workEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(191)
  personalEmail?: string;

  @ApiPropertyOptional({ example: '13800001005' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号必须为 11 位中国大陆手机号' })
  mobile?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: '出生日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string;

  @ApiPropertyOptional({ enum: Ethnicity })
  @IsOptional()
  @IsEnum(Ethnicity)
  ethnicity?: Ethnicity;

  @ApiPropertyOptional({ enum: MaritalStatus })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({ enum: PoliticalStatus })
  @IsOptional()
  @IsEnum(PoliticalStatus)
  politicalStatus?: PoliticalStatus;

  @ApiPropertyOptional({ maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  nativePlace?: string;

  @ApiPropertyOptional({ enum: HouseholdType })
  @IsOptional()
  @IsEnum(HouseholdType)
  householdType?: HouseholdType;

  @ApiPropertyOptional({ maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  householdAddress?: string;

  @ApiPropertyOptional({ maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  residentialAddress?: string;

  @ApiPropertyOptional({ enum: BankName })
  @IsOptional()
  @IsEnum(BankName)
  bankName?: BankName;

  @ApiPropertyOptional({ maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  bankBranchName?: string;

  @ApiPropertyOptional({ maxLength: 19 })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{1,19}$/, { message: '银行账号必须为 1 至 19 位数字' })
  bankAccountNumber?: string;

  @ApiPropertyOptional({ enum: IdentityDocumentType })
  @IsOptional()
  @IsEnum(IdentityDocumentType)
  documentType?: IdentityDocumentType;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  documentNumber?: string;


  @ApiPropertyOptional({ description: '证件截止日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  documentExpiryDate?: string;

  @ApiPropertyOptional({ maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  emergencyContactName?: string;

  @ApiPropertyOptional({ maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  emergencyContactRelationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  emergencyContactMobile?: string;

  @ApiPropertyOptional({ maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  graduationSchoolName?: string;

  @ApiPropertyOptional({ enum: InstitutionType })
  @IsOptional()
  @IsEnum(InstitutionType)
  institutionType?: InstitutionType;

  @ApiPropertyOptional({ enum: EducationLevel })
  @IsOptional()
  @IsEnum(EducationLevel)
  highestEducation?: EducationLevel;

  @ApiPropertyOptional({ description: '毕业日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  graduationDate?: string;

  @ApiPropertyOptional({ maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  major?: string;

  @ApiPropertyOptional({ enum: PersonnelPosition })
  @IsOptional()
  @IsEnum(PersonnelPosition)
  personnelPosition?: PersonnelPosition;

  @ApiPropertyOptional({ enum: EmployeeLevel })
  @IsOptional()
  @IsEnum(EmployeeLevel)
  employeeLevel?: EmployeeLevel;

  @ApiPropertyOptional({ enum: PersonnelCategory })
  @IsOptional()
  @IsEnum(PersonnelCategory)
  personnelCategory?: PersonnelCategory;

  @ApiPropertyOptional({ enum: EmploymentRelationship })
  @IsOptional()
  @IsEnum(EmploymentRelationship)
  employmentRelationship?: EmploymentRelationship;

  @ApiPropertyOptional({ enum: PersonnelSource })
  @IsOptional()
  @IsEnum(PersonnelSource)
  personnelSource?: PersonnelSource;

  @ApiPropertyOptional({ enum: WorkArrangement })
  @IsOptional()
  @IsEnum(WorkArrangement)
  workArrangement?: WorkArrangement;
}
