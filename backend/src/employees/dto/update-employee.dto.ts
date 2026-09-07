import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BankName,
  EducationLevel,
  EmploymentRelationship,
  EmploymentStatus,
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
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class InitialEmploymentDto {
  @ApiPropertyOptional({ description: '首段任职部门 ID' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  organizationId: string;

  @ApiPropertyOptional({ description: '首段任职入职日期，格式 YYYY-MM-DD' })
  @IsDateString({ strict: true })
  entryDate: string;

  @ApiPropertyOptional({ enum: PersonnelCategory })
  @IsOptional()
  @IsEnum(PersonnelCategory)
  personnelCategory?: PersonnelCategory;

  @ApiPropertyOptional({ enum: EmploymentRelationship })
  @IsEnum(EmploymentRelationship)
  employmentRelationship: EmploymentRelationship;

  @ApiPropertyOptional({ enum: PersonnelSource })
  @IsOptional()
  @IsEnum(PersonnelSource)
  personnelSource?: PersonnelSource;

  @ApiPropertyOptional({ enum: WorkArrangement })
  @IsEnum(WorkArrangement)
  workArrangement: WorkArrangement;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsEnum(EmploymentStatus)
  employmentStatus: EmploymentStatus;

  @ApiPropertyOptional({ enum: PersonnelPosition })
  @IsOptional()
  @IsEnum(PersonnelPosition)
  personnelPosition?: PersonnelPosition;

  @ApiPropertyOptional({ enum: EmployeeLevel })
  @IsOptional()
  @IsEnum(EmployeeLevel)
  employeeLevel?: EmployeeLevel;

  @ApiPropertyOptional({ description: '职位 ID' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  positionId?: string;

  @ApiPropertyOptional({ description: '职级固定 code' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  jobLevel?: string;

  @ApiPropertyOptional({ description: '工作地点（自由文本）', maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  workplaceName?: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: '测试员工' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ maxLength: 64, description: '国籍（地区）' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(64)
  nationality?: string;

  @ApiPropertyOptional({ description: '参加工作日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  workStartDate?: string;

  @ApiPropertyOptional({ enum: ['SOLAR', 'LUNAR'] })
  @IsOptional()
  @IsString()
  @Matches(/^(SOLAR|LUNAR)$/)
  birthdayPreference?: 'SOLAR' | 'LUNAR';

  @ApiPropertyOptional({ description: '农历生日，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  lunarBirthDate?: string;

  @ApiPropertyOptional({ description: '全日制岗位职责说明' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(32766)
  fullTimeDutyDescription?: string;

  @ApiPropertyOptional({ maxLength: 191, description: '非全时岗位名称' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  partTimePositionName?: string;

  @ApiPropertyOptional({ description: '非全时薪资（元/小时）' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\d+(?:\.\d{1,2})?$/, { message: '非全时薪资最多保留两位小数' })
  partTimeHourlyRate?: string;

  @ApiPropertyOptional({ description: '是否有公司资质权限' })
  @IsOptional()
  @IsBoolean()
  hasCompanyEquity?: boolean;

  @ApiPropertyOptional({ description: '目标部门组织 ID；变更时结束当前主要任职并创建新的任职历史' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  organizationId?: string;

  @ApiPropertyOptional({ description: '未建立任职记录时一次性补齐首段任职信息' })
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialEmploymentDto)
  initialEmployment?: InitialEmploymentDto;

  @ApiPropertyOptional({ description: '当前主要任职的职位 ID' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  positionId?: string;

  @ApiPropertyOptional({ description: '当前主要任职的职级固定 code' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  jobLevel?: string;

  @ApiPropertyOptional({ description: '当前主要任职的工作地点（自由文本）', maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  workplaceName?: string;

  @ApiPropertyOptional({ description: '当前任职开始日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  assignmentStartDate?: string;

  @ApiPropertyOptional({ description: '当前任职入职日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  entryDate?: string;

  @ApiPropertyOptional({ description: '转正日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  confirmationDate?: string;

  @ApiPropertyOptional({ description: '试岗结束日期，格式 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString({ strict: true })
  trialPostEndDate?: string;

  @ApiPropertyOptional({ description: '异动类型 ID' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  movementTypeId?: string;

  @ApiPropertyOptional({ description: '变动原因' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(32766)
  changeReason?: string;

  @ApiPropertyOptional({ description: '变动说明' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(32766)
  changeDescription?: string;

  @ApiPropertyOptional({ description: '直接经理员工 ID' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  managerEmployeeId?: string;

  @ApiPropertyOptional({ description: '当前合同机构 ID' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  agreementEmployingCompanyId?: string;

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

  @ApiPropertyOptional({ description: '籍贯行政区划代码（GB/T 2260 兼容）', maxLength: 12 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(12)
  nativePlaceRegionCode?: string;

  @ApiPropertyOptional({ enum: HouseholdType })
  @IsOptional()
  @IsEnum(HouseholdType)
  householdType?: HouseholdType;

  @ApiPropertyOptional({ description: '户籍所在地行政区划代码（GB/T 2260 兼容）', maxLength: 12 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(12)
  householdRegionCode?: string;

  @ApiPropertyOptional({ description: '联系地址行政区划代码（GB/T 2260 兼容）', maxLength: 12 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(12)
  residentialRegionCode?: string;

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

  @ApiPropertyOptional({ description: '导入累计工龄（年），非负且最多两位小数' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\d+(?:\.\d{1,2})?$/, { message: '累计工龄（年）必须为非负且最多两位小数的数字' })
  totalWorkYears?: string;

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
