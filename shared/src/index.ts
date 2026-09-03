export { POSITION_CATALOG, matchesPositionCatalogEntry, searchPositionCatalog } from './position-catalog';
export type { PositionCatalogEntry } from './position-catalog';
export { ORGANIZATION_CATALOG } from './organization-catalog';
export type { OrganizationCatalogEntry } from './organization-catalog';
export {
  CHINA_ADMINISTRATIVE_REGIONS,
  CHINA_ADMINISTRATIVE_REGION_OPTIONS,
  formatChinaAdministrativeRegion,
  getChinaAdministrativeRegionPath,
  isChinaAdministrativeRegionCode,
} from './china-administrative-regions';
export type {
  ChinaAdministrativeRegion,
  ChinaAdministrativeRegionCascaderOption,
  ChinaAdministrativeRegionPath,
} from './china-administrative-regions';

export const ROLE_CODES = ['ADMIN', 'DEPT_ADMIN', 'VIEWER'] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const EMPLOYMENT_STATUSES = [
  'PROBATION',
  'REGULAR',
  'PENDING_ENTRY',
  'TRANSFERRED_OUT',
  'PENDING_TRANSFER_IN',
  'RETIRED',
  'RESIGNED',
  'NON_REGULAR',
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const PERSONNEL_CATEGORIES = ['TALENT_PROGRAM', 'NON_TALENT_PROGRAM'] as const;
export type PersonnelCategory = (typeof PERSONNEL_CATEGORIES)[number];

export const EMPLOYMENT_RELATIONSHIPS = ['INTERNAL_EMPLOYEE', 'INTERN', 'LABOR_WORKER'] as const;
export type EmploymentRelationship = (typeof EMPLOYMENT_RELATIONSHIPS)[number];

export const PERSONNEL_SOURCES = [
  'SOCIAL_RECRUITMENT',
  'INTERNAL_REFERRAL',
  'HEADHUNTER_REFERRAL',
  'OTHER',
] as const;
export type PersonnelSource = (typeof PERSONNEL_SOURCES)[number];

export const PERSONNEL_POSITIONS = ['FRONT_OFFICE', 'MIDDLE_OFFICE', 'BACK_OFFICE'] as const;
export type PersonnelPosition = (typeof PERSONNEL_POSITIONS)[number];

export const EMPLOYEE_LEVELS = ['STAFF', 'SUPERVISOR', 'MANAGER', 'DIRECTOR', 'PRESIDENT', 'EXPERT'] as const;
export type EmployeeLevel = (typeof EMPLOYEE_LEVELS)[number];

export const JOB_LEVELS = [
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7',
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7',
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7',
  'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7',
] as const;
export type JobLevel = (typeof JOB_LEVELS)[number];

export const WORK_ARRANGEMENTS = [
  'PART_TIME',
  'LABOR_DISPATCH',
  'CONTRACT_EMPLOYMENT',
  'LABOR_EMPLOYMENT',
  'INTERN',
  'RETIREE_REEMPLOYMENT',
] as const;
export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number];

export const HOUSEHOLD_TYPES = ['LOCAL_RURAL', 'LOCAL_URBAN', 'NONLOCAL_RURAL', 'NONLOCAL_URBAN'] as const;
export type HouseholdType = (typeof HOUSEHOLD_TYPES)[number];

export const BANK_NAMES = ['ICBC'] as const;
export type BankName = (typeof BANK_NAMES)[number];

export const EDUCATION_LEVELS = [
  'DOCTORAL', 'MASTER', 'MBA', 'BACHELOR', 'DUAL_BACHELOR',
  'ASSOCIATE_DEGREE', 'OVERSEAS_HIGHER_EDUCATION', 'SECONDARY_TECHNICAL',
  'HIGH_SCHOOL', 'JUNIOR_HIGH_OR_BELOW',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const INSTITUTION_TYPES = [
  'RANK_985', 'RANK_211', 'OVERSEAS_TOP_200', 'OVERSEAS_BEYOND_TOP_100',
  'NATIONAL_UNIFIED_BACHELOR', 'THIRD_TIER_OR_PRIVATE_BACHELOR', 'NON_UNIFIED_BACHELOR',
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const MARITAL_STATUSES = ['UNMARRIED', 'MARRIED', 'DIVORCED', 'WIDOWED'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const POLITICAL_STATUSES = [
  'NON_PARTY', 'CPC_MEMBER', 'CPC_PROBATIONARY_MEMBER', 'CYL_MEMBER', 'CDF_MEMBER',
  'CDL_MEMBER', 'CDCA_MEMBER', 'CAPD_MEMBER', 'CPWDP_MEMBER', 'ZGD_MEMBER',
  'JDS_MEMBER', 'TML_MEMBER', 'NONPARTISAN', 'OTHER',
] as const;
export type PoliticalStatus = (typeof POLITICAL_STATUSES)[number];

export const ETHNICITIES = [
  'HAN', 'HUI', 'SHE', 'TATAR', 'ACHANG', 'KAZAKH', 'TUJIA', 'JINGPO', 'HANI', 'TU',
  'BAI', 'UYGHUR', 'BONAN', 'HEZHEN', 'UZBEK', 'JINO', 'BUYI', 'LAHU', 'XIBE', 'LI',
  'DONGXIANG', 'MONGOL', 'MULAO', 'DAUR', 'TIBETAN', 'MAONAN', 'YUGUR', 'RUSSIAN',
  'DEANG', 'LISU', 'YAO', 'KOREAN', 'BLANG', 'MANCHU', 'YI', 'MONBA', 'DONG', 'MIAO',
  'WA', 'QIANG', 'DERUNG', 'NU', 'LHOBA', 'PUMI', 'DAI', 'NAXI', 'GAOSHAN', 'ZHUANG',
  'OROQEN', 'TAJIK', 'JING', 'GELAO', 'EVENKI', 'SALAR', 'KYRGYZ', 'SHUI', 'CHUANQING',
  'OTHER', 'GE', 'GEJIA',
] as const;
export type Ethnicity = (typeof ETHNICITIES)[number];

export const PROCESS_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];

export const IDENTITY_DOCUMENT_TYPES = [
  'NATIONAL_ID',
  'PASSPORT',
  'HK_MACAO_PERMIT',
  'TAIWAN_PERMIT',
  'MILITARY_ID',
  'ARMED_POLICE_OFFICER_ID',
  'HK_MACAO_ID',
  'FOREIGN_PASSPORT',
  'HK_PERMANENT_ID',
  'TAIWAN_ID',
  'MACAO_PERMANENT_ID',
  'FOREIGN_PERMANENT_RESIDENCE_ID',
  'MACAO_NON_PERMANENT_ID',
  'HK_ID',
  'THAILAND_ID',
  'MALAYSIA_ID',
  'VIETNAM_ID',
  'INDONESIA_ID',
  'HK_MACAO_RESIDENCE_PERMIT',
  'TAIWAN_RESIDENCE_PERMIT',
  'MEXICO_ID',
  'SINGAPORE_ID',
  'SINGAPORE_PR',
  'SINGAPORE_EP',
  'SINGAPORE_WP',
  'SINGAPORE_SP',
  'SINGAPORE_LOC',
  'SINGAPORE_PLOC',
  'SINGAPORE_STUDENT_PASS',
  'PHILIPPINES_ID',
  'HK_MACAO_NON_CHINESE_PERMIT',
  'US_SSN',
  'CANADA_SIN',
  'MALAYSIA_OLD_ID',
  'MALAYSIA_WP',
  'MALAYSIA_PR',
  'MALAYSIA_MILITARY_ID',
  'MALAYSIA_POLICE_ID',
  'MALAYSIA_PASSPORT',
  'MALAYSIA_EP',
  'MALAYSIA_PROFESSIONAL_VISIT_PASS',
  'MALAYSIA_DEPENDENT_PASS',
  'MALAYSIA_ENTREPRENEUR_PASS',
  'MALAYSIA_TALENT_RESIDENCE_PASS',
  'MALAYSIA_LONG_TERM_SOCIAL_VISIT_PASS',
  'MALAYSIA_SHORT_TERM_SOCIAL_VISIT_PASS',
  'MALAYSIA_FOREIGN_STUDENT_PASS',
  'MALAYSIA_WORKING_HOLIDAY_PASS',
  'MALAYSIA_PROFESSIONAL_TRAINING_PASS',
  'MALAYSIA_TECHNICAL_TRAINING_PASS',
  'IANG_VISA',
  'HK_QUALITY_MIGRANT_ADMISSION_SCHEME',
  'MAINLAND_TRAVEL_PERMIT_HK_MACAO',
  'HK_TOP_TALENT_PASS_SCHEME',
  'SINGAPORE_LONG_TERM_VISIT_PASS_SG14',
  'HK_DOCUMENT_OF_IDENTITY',
  'EXIT_ENTRY_PERMIT_HK_MACAO',
  'SINGAPORE_ONE_PASS',
  'SOUTH_KOREA_ID',
  'OTHER',
] as const;
export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

export const IDENTITY_DOCUMENT_TYPE_LABELS = {
  NATIONAL_ID: '身份证',
  PASSPORT: '护照',
  HK_MACAO_PERMIT: '港澳居民来往内地通行证',
  TAIWAN_PERMIT: '台湾居民来往大陆通行证',
  MILITARY_ID: '军人证',
  ARMED_POLICE_OFFICER_ID: '武警警官证',
  HK_MACAO_ID: '港澳身份证',
  FOREIGN_PASSPORT: '外国护照',
  HK_PERMANENT_ID: '香港永久性居民身份证',
  TAIWAN_ID: '台湾身份证',
  MACAO_PERMANENT_ID: '澳门特别行政区永久性居民身份证',
  FOREIGN_PERMANENT_RESIDENCE_ID: '外国人永久居留证',
  MACAO_NON_PERMANENT_ID: '澳门特别行政区非永久性居民身份证',
  HK_ID: '香港居民身份证',
  THAILAND_ID: '泰国身份证',
  MALAYSIA_ID: '马来西亚身份证',
  VIETNAM_ID: '越南身份证',
  INDONESIA_ID: '印度尼西亚身份证',
  HK_MACAO_RESIDENCE_PERMIT: '港澳居民居住证',
  TAIWAN_RESIDENCE_PERMIT: '台湾居民居住证',
  MEXICO_ID: '墨西哥身份证',
  SINGAPORE_ID: '新加坡身份证',
  SINGAPORE_PR: '新加坡永久居民（PR）',
  SINGAPORE_EP: '新加坡亚籍（EP）',
  SINGAPORE_WP: '新加坡亚籍（WP）',
  SINGAPORE_SP: '新加坡亚籍（SP）',
  SINGAPORE_LOC: '新加坡家属准证（LOC）',
  SINGAPORE_PLOC: '新加坡家属准证（PLOC）',
  SINGAPORE_STUDENT_PASS: '新加坡学生证',
  PHILIPPINES_ID: '菲律宾身份证',
  HK_MACAO_NON_CHINESE_PERMIT: '港澳居民来往内地通行证（非中国籍）',
  US_SSN: '美国SSN',
  CANADA_SIN: '加拿大SIN',
  MALAYSIA_OLD_ID: '马来西亚旧身份证',
  MALAYSIA_WP: '马来西亚亚籍工作准证（WP）',
  MALAYSIA_PR: '马来西亚永久居民',
  MALAYSIA_MILITARY_ID: '马来西亚军人证件',
  MALAYSIA_POLICE_ID: '马来西亚警察证件',
  MALAYSIA_PASSPORT: '马来西亚护照证件',
  MALAYSIA_EP: '马来西亚亚籍工作准证（EP）',
  MALAYSIA_PROFESSIONAL_VISIT_PASS: '马来西亚专业访问准证',
  MALAYSIA_DEPENDENT_PASS: '马来西亚家属准证',
  MALAYSIA_ENTREPRENEUR_PASS: '马来西亚企业家准证',
  MALAYSIA_TALENT_RESIDENCE_PASS: '马来西亚人才居留准证',
  MALAYSIA_LONG_TERM_SOCIAL_VISIT_PASS: '马来西亚长期社交访问准证',
  MALAYSIA_SHORT_TERM_SOCIAL_VISIT_PASS: '马来西亚短期社交访问准证',
  MALAYSIA_FOREIGN_STUDENT_PASS: '马来西亚外籍学生证',
  MALAYSIA_WORKING_HOLIDAY_PASS: '马来西亚工作假期准证',
  MALAYSIA_PROFESSIONAL_TRAINING_PASS: '马来西亚专业培训准证',
  MALAYSIA_TECHNICAL_TRAINING_PASS: '马来西亚技工培训准证',
  IANG_VISA: 'IANG签证',
  HK_QUALITY_MIGRANT_ADMISSION_SCHEME: '香港优秀人才入境计划',
  MAINLAND_TRAVEL_PERMIT_HK_MACAO: '往来港澳通行证',
  HK_TOP_TALENT_PASS_SCHEME: '香港高端人才通行证计划',
  SINGAPORE_LONG_TERM_VISIT_PASS_SG14: '长期访问通行证（SG14）',
  HK_DOCUMENT_OF_IDENTITY: '香港特别行政区签证身份书（黄本）',
  EXIT_ENTRY_PERMIT_HK_MACAO: '前往港澳通行证',
  SINGAPORE_ONE_PASS: '新加坡专才准证（ONE Pass）',
  SOUTH_KOREA_ID: '韩国身份证',
  OTHER: '其他',
} as const satisfies Record<IdentityDocumentType, string>;

export const GENDERS = ['MALE', 'FEMALE', 'UNDISCLOSED'] as const;
export type Gender = (typeof GENDERS)[number];

export const CONTRACT_TERM_TYPES = ['FIXED', 'OPEN_ENDED'] as const;
export type ContractTermType = (typeof CONTRACT_TERM_TYPES)[number];

export const AGREEMENT_TYPES = [
  'LABOR_CONTRACT',
  'LABOR_SERVICE_CONTRACT',
  'INTERNSHIP_AGREEMENT',
  'OTHER',
  'NON_COMPETE_AGREEMENT',
  'RETIREE_REEMPLOYMENT_AGREEMENT',
  'NON_FULL_TIME_EMPLOYMENT_CONTRACT',
  'SPECIAL_AGREEMENT',
  'PART_TIME_SERVICE_AGREEMENT',
] as const;
export type AgreementType = (typeof AGREEMENT_TYPES)[number];

export const PERMISSIONS = {
  EMPLOYEE_READ: 'employee.read',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',
  EMPLOYEE_DATA_ALL: 'employee.data.all',
  ORGANIZATION_READ: 'organization.read',
  PERFORMANCE_READ: 'performance.read',
  PERFORMANCE_TEMPLATE_MANAGE: 'performance.template.manage',
  PERFORMANCE_CYCLE_MANAGE: 'performance.cycle.manage',
  PERFORMANCE_TASK_HANDLE: 'performance.task.handle',
  PERFORMANCE_RESULT_MODIFY: 'performance.result.modify',
  PERFORMANCE_AMOUNT_BASE_MANAGE: 'performance.amount-base.manage',
} as const;
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERFORMANCE_MODULE_TYPES = ['METRIC', 'EVALUATION', 'ADJUSTMENT'] as const;
export type PerformanceModuleType = (typeof PERFORMANCE_MODULE_TYPES)[number];
export type PerformanceModuleKind = 'metric' | 'evaluation' | 'adjustment';
export const PERFORMANCE_EXECUTOR_TYPES = ['AUTO', 'USER', 'DIRECTORY'] as const;
export type PerformanceExecutorType = (typeof PERFORMANCE_EXECUTOR_TYPES)[number];
export const PERFORMANCE_DIRECTORY_TYPES = ['POSITION', 'JOB_TITLE'] as const;
export type PerformanceDirectoryType = (typeof PERFORMANCE_DIRECTORY_TYPES)[number];
export const PERFORMANCE_VERSION_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type PerformanceVersionStatus = (typeof PERFORMANCE_VERSION_STATUSES)[number];
export const PERFORMANCE_ADJUSTMENT_DIRECTIONS = ['ADD', 'DEDUCT'] as const;
export type PerformanceAdjustmentDirection = (typeof PERFORMANCE_ADJUSTMENT_DIRECTIONS)[number];

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: RoleCode;
  roleName: string;
  permissions: PermissionCode[];
  organizationIds: string[];
}

export interface Organization {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
}

export interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  mobile: string;
  idCardNo: string | null;
  organizationId: string;
  organizationName: string;
  employmentStatus: EmploymentStatus | null;
  workEmail?: string | null;
  personalEmail?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The personnel list is a wide business view assembled from the employee
 * master record and its current related records. Nullable fields represent
 * information that has not been entered, not a missing table column.
 */
export interface EmployeeListItem extends Employee {
  entryDate: string | null;
  positionName: string | null;
  gender: Gender | null;
  personnelPosition: PersonnelPosition | null;
  jobLevel: JobLevel | null;
  employeeLevel: EmployeeLevel | null;
  workplaceName: string | null;
  /** Employee.workEmail. */
  workEmail: string | null;
  /** Employee.personalEmail; distinct from the company email. */
  personalEmail: string | null;
  personnelCategory: PersonnelCategory | null;
  personnelSource: PersonnelSource | null;
  fullTimeCompany: string | null;
  employmentRelationship: EmploymentRelationship | null;
  workArrangement: WorkArrangement | null;
  managerName: string | null;
  /** Current primary reporting manager's Employee.workEmail. */
  managerEmail: string | null;
  totalWorkYears: number | null;
  totalServiceYears: number | null;
  documentType: IdentityDocumentType | null;
  documentNumber: string | null;
  documentExpiryDate: string | null;
  birthDate: string | null;
  age: number | null;
  ethnicity: Ethnicity | null;
  maritalStatus: MaritalStatus | null;
  politicalStatus: PoliticalStatus | null;
  nativePlace: string | null;
  /** GB/T 2260 compatible administrative-division code selected for 籍贯. */
  nativePlaceRegionCode: string | null;
  householdType: HouseholdType | null;
  /** GB/T 2260 compatible administrative-division code selected for 户籍所在地. */
  householdRegionCode: string | null;
  householdAddress: string | null;
  /** GB/T 2260 compatible administrative-division code selected for 联系地址. */
  residentialRegionCode: string | null;
  residentialAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactMobile: string | null;
  bankName: BankName | null;
  bankBranchName: string | null;
  bankAccountNumber: string | null;
  graduationSchoolName: string | null;
  institutionType: InstitutionType | null;
  highestEducation: EducationLevel | null;
  graduationDate: string | null;
  major: string | null;
}

export interface EmployeeDetail extends EmployeeListItem {
  assignmentId: string | null;
  positionId: string | null;
  workplaceId: string | null;
  /** Current effective EmployeeAgreement.employingCompany ID, never an assignment field. */
  agreementEmployingCompanyId: string | null;
  primaryDocumentId: string | null;
  emergencyContactId: string | null;
  highestEducationId: string | null;
}

export const PERSONNEL_FIELDS = [
  { key: 'employeeNo', title: '工号', dataType: 'string', importable: true, computed: false },
  { key: 'name', title: '姓名', dataType: 'string', importable: true, computed: false },
  { key: 'organizationName', title: '部门', dataType: 'relation', importable: true, computed: false },
  { key: 'entryDate', title: '入职日期', dataType: 'date', importable: true, computed: false },
  { key: 'positionName', title: '职位', dataType: 'relation', importable: true, computed: false },
  { key: 'gender', title: '性别', dataType: 'enum', importable: true, computed: false },
  { key: 'personnelPosition', title: '人员定位', dataType: 'enum', importable: true, computed: false },
  { key: 'jobLevel', title: '职级', dataType: 'enum', importable: true, computed: false },
  { key: 'employeeLevel', title: '员工层级', dataType: 'enum', importable: true, computed: false },
  { key: 'workplaceName', title: '工作地点', dataType: 'relation', importable: true, computed: false },
  { key: 'workEmail', title: '企业邮箱', dataType: 'string', importable: true, computed: false },
  { key: 'personalEmail', title: '个人邮箱', dataType: 'string', importable: true, computed: false },
  { key: 'mobile', title: '手机号码', dataType: 'string', importable: true, computed: false },
  { key: 'personnelCategory', title: '人员类别', dataType: 'enum', importable: true, computed: false },
  { key: 'personnelSource', title: '人员来源', dataType: 'enum', importable: true, computed: false },
  { key: 'employmentStatus', title: '人员状态', dataType: 'enum', importable: true, computed: false },
  { key: 'fullTimeCompany', title: '全日制公司', dataType: 'relation', importable: true, computed: false },
  { key: 'employmentRelationship', title: '雇佣关系', dataType: 'enum', importable: true, computed: false },
  { key: 'workArrangement', title: '用工形式', dataType: 'enum', importable: true, computed: false },
  { key: 'managerName', title: '直线经理', dataType: 'relation', importable: true, computed: false },
  { key: 'managerEmail', title: '直线经理邮箱', dataType: 'string', importable: false, computed: true },
  { key: 'totalWorkYears', title: '累计工龄（年）', dataType: 'number', importable: false, computed: true },
  { key: 'totalServiceYears', title: '累计司龄（年）', dataType: 'number', importable: false, computed: true },
  { key: 'documentType', title: '证件类型', dataType: 'enum', importable: true, computed: false },
  { key: 'documentNumber', title: '证件号码', dataType: 'string', importable: true, computed: false },
  { key: 'documentExpiryDate', title: '证件截止日期', dataType: 'date', importable: true, computed: false },
  { key: 'birthDate', title: '出生日期', dataType: 'date', importable: true, computed: false },
  { key: 'age', title: '年龄', dataType: 'number', importable: false, computed: true },
  { key: 'ethnicity', title: '民族', dataType: 'enum', importable: true, computed: false },
  { key: 'maritalStatus', title: '婚姻状况', dataType: 'enum', importable: true, computed: false },
  { key: 'politicalStatus', title: '政治面貌', dataType: 'enum', importable: true, computed: false },
  { key: 'nativePlace', title: '籍贯详细说明', dataType: 'string', importable: true, computed: false },
  { key: 'nativePlaceRegionCode', title: '籍贯地区', dataType: 'string', importable: true, computed: false },
  { key: 'householdType', title: '户口类别', dataType: 'enum', importable: true, computed: false },
  { key: 'householdRegionCode', title: '户籍所在地地区', dataType: 'string', importable: true, computed: false },
  { key: 'householdAddress', title: '户籍详细地址', dataType: 'string', importable: true, computed: false },
  { key: 'residentialRegionCode', title: '联系地址地区', dataType: 'string', importable: true, computed: false },
  { key: 'residentialAddress', title: '联系详细地址', dataType: 'string', importable: true, computed: false },
  { key: 'emergencyContactName', title: '紧急联系人', dataType: 'string', importable: true, computed: false },
  { key: 'emergencyContactRelationship', title: '与本人关系', dataType: 'string', importable: true, computed: false },
  { key: 'emergencyContactMobile', title: '紧急联系人电话', dataType: 'string', importable: true, computed: false },
  { key: 'bankName', title: '银行', dataType: 'enum', importable: true, computed: false },
  { key: 'bankBranchName', title: '开户行支行', dataType: 'string', importable: true, computed: false },
  { key: 'bankAccountNumber', title: '银行账号', dataType: 'string', importable: true, computed: false },
  { key: 'graduationSchoolName', title: '毕业学校名称', dataType: 'string', importable: true, computed: false },
  { key: 'institutionType', title: '院校类型', dataType: 'enum', importable: true, computed: false },
  { key: 'highestEducation', title: '最高学历', dataType: 'enum', importable: true, computed: false },
  { key: 'graduationDate', title: '毕业时间', dataType: 'date', importable: true, computed: false },
  { key: 'major', title: '专业', dataType: 'string', importable: true, computed: false },
] as const;

export type PersonnelTransferFormat = 'XLSX' | 'CSV';
export const PERSONNEL_TRANSFER_FORMATS = ['XLSX', 'CSV'] as const;
export type PersonnelTransferFieldKey = (typeof PERSONNEL_FIELDS)[number]['key'];

export interface EmployeeExportInput {
  format: PersonnelTransferFormat;
  fields: PersonnelTransferFieldKey[];
  employeeIds?: string[];
  query?: Pick<EmployeeListQuery, 'keyword' | 'organizationId' | 'status'> & {
    startDateFrom?: string;
    startDateTo?: string;
    entryDateFrom?: string;
    entryDateTo?: string;
    lastWorkingDateFrom?: string;
    lastWorkingDateTo?: string;
  };
}

export interface EmployeeTransferRowResult {
  rowNumber: number;
  employeeNo: string | null;
  action: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED';
  errors: string[];
  warnings?: string[];
}

export interface EmployeeImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: EmployeeTransferRowResult[];
}

export const PERSONNEL_FIELD_CONTRACT_VERSION = '1.0.0';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface EmployeeListQuery {
  keyword?: string;
  organizationId?: string;
  status?: EmploymentStatus;
  page?: number;
  pageSize?: number;
}

/** Current internal employees whose current employment status is REGULAR. */
export interface RegularEmployeeListQuery {
  keyword?: string;
  /** Includes the selected organization and its descendants. */
  organizationId?: string;
  page?: number;
  pageSize?: number;
}

/** Read-only current regular-employee row for the personnel page. */
export interface RegularEmployeeListItem {
  employeeId: string;
  canViewEmployeeDetail: boolean;
  name: string;
  employeeNo: string;
  entryDate: string;
  departmentName: string;
  positionName: string | null;
  jobLevel: JobLevel | null;
  gender: Gender | null;
  workEmail: string | null;
  workArrangement: WorkArrangement;
  managerName: string | null;
  /** No confirmed Candidate or resume source exists for this employee row. */
  resumeInfo: null;
  /** No confirmed interview-evaluation source exists for this employee row. */
  interviewEvaluation: null;
  bankName: BankName | null;
  bankAccountNumber: string | null;
  bankBranchName: string | null;
  /** Current effective EmployeeAgreement.employingCompany.name. */
  fullTimeCompany: string | null;
}

export interface EmployeeSubsetListQuery {
  keyword?: string;
  organizationId?: string;
  page?: number;
  pageSize?: number;
}

export interface EducationListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  workEmail: string | null;
  departmentName: string | null;
  startDate: string | null;
  endDate: string | null;
  schoolName: string;
  schoolType: null;
  major: string | null;
  educationLevel: string;
  degree: string | null;
  isHighestEducation: boolean;
  canViewEmployeeDetail: boolean;
}

export interface WorkHistoryListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  workEmail: string | null;
  departmentName: string | null;
  companyName: string;
  jobTitleName: string | null;
  startDate: string | null;
  endDate: string | null;
  referenceName: string | null;
  approvalStatus: null;
  canViewEmployeeDetail: boolean;
}

export interface FamilyListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  workEmail: string | null;
  departmentName: string | null;
  memberName: string;
  relationshipName: string;
  gender: string | null;
  mobile: string | null;
  approvalStatus: null;
  canViewEmployeeDetail: boolean;
}

export interface AppraisalListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  workEmail: string | null;
  departmentName: string | null;
  appraisalYear: number | null;
  periodName: string;
  performanceActivity: string;
  appraisalDepartment: null;
  finalScore: number | null;
  startDate: string | null;
  endDate: string | null;
  canViewEmployeeDetail: boolean;
}

export interface TrainingListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  workEmail: string | null;
  departmentName: string | null;
  startDate: string | null;
  endDate: string | null;
  trainingName: string;
  trainingProvider: string | null;
  trainingResult: string | null;
  approvalStatus: null;
  credits: null;
  canViewEmployeeDetail: boolean;
}

export interface AwardListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  workEmail: string | null;
  departmentName: string | null;
  awardDate: string | null;
  awardName: string;
  summary: string | null;
  approvalStatus: null;
  canViewEmployeeDetail: boolean;
}

export interface CertificateListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  workEmail: string | null;
  departmentName: string | null;
  certificateName: string;
  certificateNo: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  approvalStatus: null;
  canViewEmployeeDetail: boolean;
}

export interface ProjectListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  workEmail: string | null;
  departmentName: string | null;
  startDate: string | null;
  endDate: string | null;
  projectName: string;
  projectRole: string | null;
  description: string | null;
  approvalStatus: null;
  canViewEmployeeDetail: boolean;
}

export interface SkillListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  workEmail: string | null;
  departmentName: string | null;
  skillName: string;
  proficiencyLevel: string | null;
  skillCategory: string | null;
  approvalStatus: null;
  canViewEmployeeDetail: boolean;
}

export interface LanguageListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  workEmail: string | null;
  departmentName: string | null;
  language: string;
  nativeLanguage: null;
  proficiencyLevel: null;
  writingLevel: string | null;
  readingLevel: string | null;
  speakingLevel: string | null;
  approvalStatus: null;
  canViewEmployeeDetail: boolean;
}

/** Read-only blacklist list row. */
export interface BlacklistListItem {
  id: string;
  employeeId: string | null;
  canViewEmployeeDetail: boolean;
  name: string;
  documentNumber: string | null;
  mobile: string | null;
  reason: string;
  effectiveDate: string;
  expiryDate: string | null;
  /** Associated Employee.workEmail, or null when unavailable. */
  workEmail: string | null;
}

export interface BlacklistListQuery {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface EmployeeInfoApprovalListItem {
  id: string;
  employeeId: string | null;
  canViewEmployeeDetail: boolean;
  employeeName: string | null;
  departmentName: string | null;
  activityName: string | null;
  applicantName: string | null;
  submittedAt: string | null;
  status: ProcessStatus | null;
  currentApproverName: string | null;
}

export interface EmployeeInfoApprovalListQuery {
  keyword?: string;
  departmentId?: string;
  status?: ProcessStatus;
  page?: number;
  pageSize?: number;
}

export interface OnboardingListQuery {
  page?: number;
  pageSize?: number;
}

export const OFFER_LIST_VIEWS = [
  'PENDING_SEND',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'ONBOARDED',
  'ALL',
] as const;
export type OfferListView = (typeof OFFER_LIST_VIEWS)[number];

export interface OfferListQuery {
  view?: OfferListView;
  page?: number;
  pageSize?: number;
}

/** A selectable directory entry for the new internship Offer form. */
export interface InternOfferOption {
  id: string;
  name: string;
  /** Present for department directory entries so the frontend can render a hierarchy. */
  parentId?: string | null;
  /** Present for position directory entries; preserves the company position number. */
  code?: string;
  organizationId?: string | null;
  /** Available for workplace directory entries. Address is display-only/derived for Offers. */
  address?: string | null;
}

/** Employee option that intentionally contains only the fields needed to choose a direct manager. */
export interface InternOfferManagerOption extends InternOfferOption {
  employeeNo: string;
}

/**
 * MySQL-only directory data for the new internship Offer form. Managers honor
 * the current employee data scope; workplaces expose their directory address
 * for derived display only.
 */
export interface InternOfferFormOptions {
  organizations: InternOfferOption[];
  positions: InternOfferOption[];
  workplaces: InternOfferOption[];
  employingCompanies: InternOfferOption[];
  managers: InternOfferManagerOption[];
}

export interface CandidateIdentityDocumentInput {
  documentType: IdentityDocumentType;
  documentNumber: string;
  isPrimary?: boolean;
  expiryDate?: string;
}

export interface CandidateEducationExperienceInput {
  schoolName: string;
  educationLevel: EducationLevel;
  major?: string;
  graduationDate?: string;
  isHighestEducation?: boolean;
}

/** Decimal values cross the HTTP boundary as canonical non-negative decimal strings. */
export interface OfferCompensationSnapshotInput {
  salaryPackage?: string;
  salaryRemark?: string;
  preConfirmationBaseSalary?: string;
  postConfirmationBaseSalary?: string;
  preConfirmationMonthlyPerformance?: string;
  postConfirmationMonthlyPerformance?: string;
  preConfirmationMonthlyManagementPerformance?: string;
  postConfirmationMonthlyManagementPerformance?: string;
  fullTimeContractSalary?: string;
  annualPerformance?: string;
}

export interface OfferPartTimeSnapshotInput {
  positionName?: string;
  hourlyRate?: string;
}

/**
 * Typed Offer and Candidate snapshots. The server always fixes
 * employmentRelationship to INTERN and never creates Employee, assignment,
 * reporting, agreement, or approval records from this request.
 */
export interface CreateInternOfferInput {
  name: string;
  mobile: string;
  personalEmail: string;
  source: PersonnelSource;
  gender?: Gender;
  birthDate?: string;
  workStartDate?: string;
  identityDocument?: CandidateIdentityDocumentInput;
  educationExperience?: CandidateEducationExperienceInput;
  organizationId: string;
  positionId: string;
  workplaceId?: string;
  proposedEntryDate: string;
  probationMonths?: number;
  jobLevel?: JobLevel;
  employeeLevel?: EmployeeLevel;
  personnelCategory?: PersonnelCategory;
  workArrangement?: WorkArrangement;
  directManagerEmployeeId?: string;
  employingCompanyId?: string;
  agreementType?: AgreementType;
  contractTermType?: ContractTermType;
  contractMonths?: number;
  contractEndDate?: string;
  isSeparatelySigned?: boolean;
  compensationSnapshot?: OfferCompensationSnapshotInput;
  partTimeSnapshot?: OfferPartTimeSnapshotInput;
}

export interface CreatedCandidateIdentityDocument {
  id: string;
  documentType: IdentityDocumentType;
  documentNumber: string;
  isPrimary: boolean;
  expiryDate: string | null;
}

export interface CreatedCandidateEducationExperience {
  id: string;
  schoolName: string;
  educationLevel: EducationLevel;
  major: string | null;
  graduationDate: string | null;
  isHighestEducation: boolean;
}

export interface CreatedOfferCompensationSnapshot {
  salaryPackage: string | null;
  salaryRemark: string | null;
  preConfirmationBaseSalary: string | null;
  postConfirmationBaseSalary: string | null;
  preConfirmationMonthlyPerformance: string | null;
  postConfirmationMonthlyPerformance: string | null;
  preConfirmationMonthlyManagementPerformance: string | null;
  postConfirmationMonthlyManagementPerformance: string | null;
  fullTimeContractSalary: string | null;
  annualPerformance: string | null;
}

export interface CreatedOfferPartTimeSnapshot {
  positionName: string | null;
  hourlyRate: string | null;
}

/** Full persisted snapshot returned when a DRAFT internship Offer is created. */
export interface CreatedInternOffer {
  id: string;
  offerNo: string;
  candidate: {
    id: string;
    name: string;
    mobile: string;
    personalEmail: string;
    source: PersonnelSource;
    gender: Gender | null;
    birthDate: string | null;
    workStartDate: string | null;
    identityDocument: CreatedCandidateIdentityDocument | null;
    educationExperience: CreatedCandidateEducationExperience | null;
  };
  organizationId: string;
  positionId: string;
  workplaceId: string | null;
  proposedEntryDate: string;
  probationMonths: number | null;
  jobLevel: JobLevel | null;
  employeeLevel: EmployeeLevel | null;
  personnelCategory: PersonnelCategory | null;
  workArrangement: WorkArrangement | null;
  directManagerEmployeeId: string | null;
  employingCompanyId: string | null;
  agreementType: AgreementType | null;
  contractTermType: ContractTermType | null;
  contractMonths: number | null;
  contractEndDate: string | null;
  isSeparatelySigned: boolean | null;
  compensationSnapshot: CreatedOfferCompensationSnapshot | null;
  partTimeSnapshot: CreatedOfferPartTimeSnapshot | null;
  employmentRelationship: 'INTERN';
  status: 'DRAFT';
  issueDate: null;
}

/** A selectable current intern in the caller's current organization scope. */
export interface InternConversionEmployeeOption {
  id: string;
  name: string;
  employeeNo: string;
}

/**
 * Read-only values mapped from a current, scoped intern. Null means the
 * employee data has no confirmed source for the corresponding Offer field.
 * The client may edit every value before direct Offer creation.
 */
export interface InternConversionOfferPrefill {
  name: string;
  mobile: string;
  personalEmail: string | null;
  source: PersonnelSource | null;
  gender: Gender | null;
  birthDate: string | null;
  identityDocument: CandidateIdentityDocumentInput | null;
  educationExperience: CandidateEducationExperienceInput | null;
  organizationId: string | null;
  positionId: string | null;
  workplaceId: string | null;
  jobLevel: JobLevel | null;
  employeeLevel: EmployeeLevel | null;
  personnelCategory: PersonnelCategory | null;
  workArrangement: WorkArrangement | null;
  directManagerEmployeeId: string | null;
  employingCompanyId: string | null;
  agreementType: AgreementType | null;
  contractTermType: ContractTermType | null;
  contractEndDate: string | null;
}

export interface OfferViewCounts {
  pendingSend: number;
  sent: number;
  accepted: number;
  rejected: number;
  onboarded: number;
  all: number;
}

export type ProbationListView = 'expiring' | 'reviewing' | 'approval' | 'all' | 'completed';

export interface ProbationListQuery {
  view?: ProbationListView;
  keyword?: string;
  status?: ProcessStatus;
  startDateFrom?: string;
  startDateTo?: string;
  plannedEndDateFrom?: string;
  plannedEndDateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Read-only probation row sourced from ProbationRecord. Department and
 * position are the authorized assignment effective on the probation start
 * date; detail availability reflects the employee's current data scope.
 */
export interface ProbationListItem {
  id: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  departmentName: string | null;
  positionName: string | null;
  startDate: string;
  plannedEndDate: string;
  canViewEmployeeDetail: boolean;
}

export interface InternListQuery {
  keyword?: string;
  startDateFrom?: string;
  startDateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Current, read-only internship-period row. Fields without a confirmed source
 * or safe authorization contract are returned as null by the API.
 */
export interface InternListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  workEmail: string | null;
  internshipOrganizationName: string | null;
  departmentName: string | null;
  positionName: string | null;
  startDate: string;
  approvalStatus: string | null;
  managerName: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankBranchName: string | null;
  canViewEmployeeDetail: boolean;
}

export interface LaborWorkerListQuery {
  keyword?: string;
  entryDateFrom?: string;
  entryDateTo?: string;
  page?: number;
  pageSize?: number;
}

/** Personnel-page-specific current labor-worker query. */
export interface PersonnelLaborWorkerListQuery {
  keyword?: string;
  entryDateFrom?: string;
  entryDateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Personnel-page row rooted at the current primary assignment for one current
 * labor-worker employment period. This intentionally differs from the
 * employment-management LaborWorkerListItem and has no workplace column.
 */
export interface PersonnelLaborWorkerListItem {
  name: string;
  /** Employee.workEmail. */
  workEmail: string | null;
  employeeNo: string;
  entryDate: string;
  departmentName: string;
  jobTitleName: string | null;
  positionName: string | null;
  workArrangement: WorkArrangement;
  managerName: string | null;
  employeeId: string;
  canViewEmployeeDetail: boolean;
}

/**
 * Current, read-only labor-worker employment-period row. Company email comes
 * from Employee.workEmail.
 */
export interface LaborWorkerListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  workEmail: string | null;
  employeeNo: string;
  entryDate: string;
  departmentName: string | null;
  jobTitleName: string | null;
  /** Current effective EmployeeAssignment.workArrangement. */
  workArrangement: WorkArrangement | null;
  managerName: string | null;
  workplaceName: string | null;
  canViewEmployeeDetail: boolean;
}

export const ASSIGNMENT_TYPES = ['PRIMARY', 'ADDITIONAL', 'TEMPORARY'] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export const ASSIGNMENT_STATUSES = ['ACTIVE', 'ENDED'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export type EmploymentRecordListView = 'current' | 'history';

export const EMPLOYMENT_RECORD_LIST_VIEWS = ['current', 'history'] as const;

export interface EmploymentRecordListQuery {
  view?: EmploymentRecordListView;
  keyword?: string;
  organizationId?: string;
  personnelStatus?: EmploymentStatus;
  assignmentStatus?: AssignmentStatus;
  startDateFrom?: string;
  startDateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Read-only employment assignment row. The API returns one row per visible
 * assignment and exposes resume availability only as an authorized marker;
 * it never returns resume contents or attachment identifiers.
 */
export interface EmploymentRecordListItem {
  id: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  entryDate: string | null;
  departmentName: string | null;
  positionName: string | null;
  positionStartDate: string;
  positionEndDate: string | null;
  personnelLocator: null;
  personnelStatus: EmploymentStatus | null;
  assignmentStatus: AssignmentStatus;
  approvalStatus: null;
  isLatestPrimaryRecord: boolean;
  interviewEvaluation: null;
  availability: 'AVAILABLE' | null;
  canViewEmployeeDetail: boolean;
}

export interface PartTimeListQuery {
  keyword?: string;
  assignmentType?: AssignmentType;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Current, read-only part-time assignment row. The API returns null for
 * business fields that have no explicit source in EmployeeAssignment.
 */
export interface PartTimeListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  partTimeType: null;
  startDate: string;
  institutionName: null;
  departmentName: string | null;
  managerName: null;
  jobTitleName: string | null;
  endDate: string | null;
  assignmentStatus: AssignmentStatus;
  approvalStatus: null;
  canViewEmployeeDetail: boolean;
}

export interface TrialPostListQuery {
  keyword?: string;
  status?: ProcessStatus;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Read-only trial-post row assembled from TrialPostRecord and its explicit
 * Position -> Organization relation.
 */
export interface TrialPostListItem {
  id: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  startDate: string;
  endDate: string | null;
  movementTypeName: string | null;
  departmentName: string | null;
  jobTitleName: string | null;
  result: string | null;
  status: ProcessStatus;
  canViewEmployeeDetail: boolean;
}

export type EmployeeMovementListView = 'active' | 'completed' | 'all';

export interface EmployeeMovementListQuery {
  view?: EmployeeMovementListView;
  keyword?: string;
  approvalStatus?: ProcessStatus;
  effectiveDateFrom?: string;
  effectiveDateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Read-only movement row assembled from EmployeeMovement and its explicit
 * relations. Fields without a source in the current schema stay null rather
 * than being inferred from another employment or approval record.
 */
export interface EmployeeMovementListItem {
  id: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  effectiveDate: string;
  movementTypeName: string;
  /** No employee-facing movement-type field exists in the current data model. Always null. */
  movementTypeEmployeeName: null;
  /** EmployeeMovement.status; kept separate from the optional approval flow status. */
  movementStatus: ProcessStatus;
  approvalStatus: ProcessStatus | null;
  fromDepartmentName: string | null;
  fromPositionName: string | null;
  fromJobLevel: JobLevel | null;
  toDepartmentName: string | null;
  toPositionName: string | null;
  toJobLevel: JobLevel | null;
  /** EmployeeMovement has no workplace relation in the current data model. Always null. */
  toWorkplaceName: null;
  /** EmployeeMovement has no handover relation in the current data model. Always null. */
  handoverStatus: null;
  currentApproverName: string | null;
  /** EmployeeMovement has no trial-post relation in the current data model. Always null. */
  trialPostEndDate: null;
  canViewEmployeeDetail: boolean;
}

export type LastWorkingDateBasis = 'ACTUAL' | 'PLANNED';

export type TerminationListView = 'active' | 'completed' | 'all';

export interface TerminationListQuery {
  view?: TerminationListView;
  keyword?: string;
  status?: ProcessStatus;
  /** Filters the resolved last-working date: actual when present, otherwise planned. */
  lastWorkingDateFrom?: string;
  lastWorkingDateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Read-only termination row. Department and position are the authorized primary
 * assignment effective on the resolved last-working date.
 */
export interface TerminationListItem {
  id: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  previousDepartmentName: string | null;
  previousPositionName: string | null;
  lastWorkingDate: string;
  lastWorkingDateBasis: LastWorkingDateBasis;
  terminationType: string;
  terminationReason: string | null;
  approvalStatus: ProcessStatus | null;
  currentApproverName: string | null;
  handoverStatus: ProcessStatus | null;
  /** No compensation source exists in the current data model. Always null. */
  compensationAmount: null;
  canViewEmployeeDetail: boolean;
}

/** Personnel-page query for completed, unarchived resignation records. */
export interface PersonnelResignedListQuery {
  keyword?: string;
  /** Filters actual last-working date when present, otherwise planned date. */
  lastWorkingDateFrom?: string;
  /** Filters actual last-working date when present, otherwise planned date. */
  lastWorkingDateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Personnel-page row for a completed termination record. It deliberately has
 * no employee-detail action: historical visibility is determined at the
 * termination date, independently from current employee-detail scope.
 */
export interface PersonnelResignedListItem {
  id: string;
  employeeNo: string;
  name: string;
  departmentName: string | null;
  gender: Gender | null;
  entryDate: string | null;
  previousPositionName: string | null;
  terminationReason: string | null;
  /** No confirmed TerminationRecord-to-EmployeeMovement relation exists. */
  movementType: null;
  lastWorkingDate: string;
  lastWorkingDateBasis: LastWorkingDateBasis;
  fullTimeCompany: string | null;
  documentNumber: string | null;
  mobile: string;
}

export interface RetirementListQuery {
  keyword?: string;
  status?: ProcessStatus;
  plannedRetirementDateFrom?: string;
  plannedRetirementDateTo?: string;
  /** Includes the selected organization and its descendants. */
  departmentId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Read-only retirement row. Department and job title come only from the primary
 * assignment in the RetirementRecord employment period that is effective on
 * the planned date.
 */
export interface RetirementListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  gender: Gender | null;
  age: number | null;
  birthDate: string | null;
  plannedRetirementDate: string | null;
  departmentName: string | null;
  jobTitleName: string | null;
  canViewEmployeeDetail: boolean;
}

export interface OfferListItem {
  id: string;
  name: string;
  personalEmail: string | null;
  mobile: string | null;
  gender: Gender | null;
  organizationName: string | null;
  /** The external applied position is not modeled yet. Always null. */
  appliedPositionName: null;
  /** The internal offered position comes from Offer.position. */
  offeredPositionName: string | null;
  workplaceName: string | null;
  proposedEntryDate: string | null;
  probationMonths: number | null;
  /** No Offer sender relation exists in the current model. Always null. */
  offerSenderName: null;
  issueDate: string | null;
  /** No recommender relation exists in the current model. Always null. */
  recommenderName: null;
  acceptedAt: string | null;
  /** No synchronization record exists in the current model. Always null. */
  syncStatus: null;
  /** No rejected-at field exists in the current model. Always null. */
  rejectedAt: null;
  rejectedReason: string | null;
  entryDate: string | null;
  approvalStatus: null;
  currentApproverName: null;
  offerStatus: ProcessStatus;
  resumeInfo: 'AVAILABLE' | null;
}

export interface PaginatedOfferList {
  data: OfferListItem[];
  meta: PageMeta & { viewCounts: OfferViewCounts };
}

export interface OnboardingEntryListItem {
  id: string;
  name: string;
  gender: string | null;
  plannedOrganizationName: string | null;
  plannedEntryDate: string | null;
  entryType: string | null;
  plannedWorkplaceName: string | null;
  positionName: string | null;
  jobLevel: JobLevel | null;
  managerName: string | null;
  onboardingStatus: string | null;
  preparationStatus: string | null;
  informationCollectionStatus: string | null;
  materialStatus: string | null;
  employmentRelationship: string | null;
  /** Current-period uniquely confirmed EmployeeAgreement.employingCompany.name. */
  fullTimeCompany: string | null;
  contractType: AgreementType | null;
  effectiveDate: string | null;
  terminationDate: string | null;
  dataSource: string | null;
  currentApproverName: string | null;
}

export interface OnboardingIntegrationListItem {
  id: string;
  employeeName: string;
  organizationName: string | null;
  jobTitleName: string | null;
  entryDate: string | null;
  managerName: string | null;
  integrationStatus: string | null;
  integrationProgress: number | null;
}

export interface EmployeeIntroductionListItem {
  id: string;
  name: string;
  gender: string | null;
  organizationName: string | null;
  positionName: string | null;
  entryDate: string | null;
  introductionStatus: string | null;
}

export interface IdCardReadListItem {
  id: string;
  name: string;
  gender: string | null;
  ethnicity: string | null;
  birthDate: string | null;
  householdAddress: string | null;
  documentType: IdentityDocumentType | null;
  documentNumber: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  lastWorkingDate: string | null;
  previousOrganizationName: string | null;
  terminationType: string | null;
  terminationReason: string | null;
  photo: 'AVAILABLE' | null;
  recordedBy: string | null;
  recordedAt: string | null;
}

export interface CreateEmployeeInput {
  employeeNo: string;
  name: string;
  workEmail: string;
  personalEmail: string;
  gender: Gender;
  personnelCategory: PersonnelCategory;
  employmentRelationship: EmploymentRelationship;
  personnelSource: PersonnelSource;
  workArrangement: WorkArrangement;
  mobile: string;
  documentType: IdentityDocumentType;
  documentNumber: string;
  documentExpiryDate: string;
  entryDate: string;
  organizationId: string;
  positionId?: string;
  jobLevel?: JobLevel;
  workplaceId?: string;
  personnelPosition: PersonnelPosition;
  employeeLevel: EmployeeLevel;
  /** Required EmployingCompany for the EmployeeAgreement created with this employee. */
  agreementEmployingCompanyId: string;
  nativePlaceRegionCode?: string;
  householdType: HouseholdType;
  householdRegionCode?: string;
  residentialRegionCode?: string;
  bankName: BankName;
  bankBranchName: string;
  bankAccountNumber: string;
  birthDate: string;
  ethnicity: Ethnicity;
  maritalStatus: MaritalStatus;
  politicalStatus: PoliticalStatus;
  householdAddress: string;
  residentialAddress: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactMobile: string;
  graduationSchoolName: string;
  institutionType: InstitutionType;
  highestEducation: EducationLevel;
  graduationDate: string;
  major: string;
  hasProbation: boolean;
  probationMonths?: number;
  probationEndDate?: string;
  managerEmployeeId?: string;
  /** Required term type for the EmployeeAgreement created with this employee. */
  contractTermType: ContractTermType;
  contractMonths?: number;
  contractEndDate?: string;
  employmentStatus: EmploymentStatus;
}

export interface EmployeeFormOption {
  id: string;
  name: string;
}

export interface EmployeePositionOption extends EmployeeFormOption {
  code: string;
  organizationId: string | null;
}

export interface EmployeeManagerOption extends EmployeeFormOption {
  employeeNo: string;
}

export interface EmployeeDirectoryOption extends EmployeeFormOption {
  code: string;
}

export interface EmployeeFormOptions {
  positions: EmployeePositionOption[];
  workplaces: EmployeeFormOption[];
  managers: EmployeeManagerOption[];
  employingCompanies?: EmployeeDirectoryOption[];
}

export interface InitialEmploymentInput {
  organizationId: string;
  entryDate: string;
  employmentRelationship: EmploymentRelationship;
  workArrangement: WorkArrangement;
  employmentStatus: EmploymentStatus;
  personnelCategory?: PersonnelCategory;
  personnelSource?: PersonnelSource;
  personnelPosition?: PersonnelPosition;
  employeeLevel?: EmployeeLevel;
  positionId?: string;
  jobLevel?: JobLevel;
  workplaceId?: string;
}

export interface UpdateEmployeeInput {
  employeeNo?: string;
  name?: string;
  /** Set only when changing an existing primary assignment. */
  organizationId?: string;
  /** Required with the initial-assignment fields when no current primary assignment exists. */
  initialEmployment?: InitialEmploymentInput;
  employmentStatus?: EmploymentStatus;
  workEmail?: string;
  personalEmail?: string;
  mobile?: string;
  gender?: Gender;
  birthDate?: string;
  ethnicity?: Ethnicity;
  maritalStatus?: MaritalStatus;
  politicalStatus?: PoliticalStatus;
  nativePlace?: string;
  nativePlaceRegionCode?: string;
  householdType?: HouseholdType;
  householdRegionCode?: string;
  householdAddress?: string;
  residentialRegionCode?: string;
  residentialAddress?: string;
  bankName?: BankName;
  bankBranchName?: string;
  bankAccountNumber?: string;
  documentType?: IdentityDocumentType;
  documentNumber?: string;
  documentExpiryDate?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactMobile?: string;
  graduationSchoolName?: string;
  institutionType?: InstitutionType;
  highestEducation?: EducationLevel;
  graduationDate?: string;
  major?: string;
  personnelPosition?: PersonnelPosition;
  employeeLevel?: EmployeeLevel;
  personnelCategory?: PersonnelCategory;
  employmentRelationship?: EmploymentRelationship;
  personnelSource?: PersonnelSource;
  workArrangement?: WorkArrangement;
}

export interface PerformanceExecutorDefinition {
  type: PerformanceExecutorType;
  userId?: string;
  directoryType?: PerformanceDirectoryType;
  directoryId?: string;
}

export interface PerformanceRuleNode {
  op: 'constant' | 'field' | 'add' | 'subtract' | 'multiply' | 'divide' | 'min' | 'max' | 'if';
  value?: number;
  field?: string;
  args?: PerformanceRuleNode[];
  condition?: { field: string; operator: '<' | '<=' | '>' | '>=' | '=' | '!='; value: number };
  then?: PerformanceRuleNode;
  otherwise?: PerformanceRuleNode;
}

export interface PerformanceIndicatorDefinition {
  id: string;
  name: string;
  description: string;
  standards: string[];
  weight: number;
  dataField?: string;
  rule?: PerformanceRuleNode;
}

export interface PerformanceModuleDefinition {
  id: string;
  name: string;
  type: PerformanceModuleType;
  enabled: boolean;
  participatesInTotal: boolean;
  weight: number | null;
  description: string;
  executor: PerformanceExecutorDefinition;
  indicators: PerformanceIndicatorDefinition[];
  adjustmentDirection?: PerformanceAdjustmentDirection;
  adjustmentMin?: number;
  adjustmentMax?: number;
  requireComment?: boolean;
  requireAttachment?: boolean;
}

export interface PerformanceTemplateDefinition {
  schemaVersion: 1;
  name: string;
  description?: string;
  modules: PerformanceModuleDefinition[];
}

export interface PerformanceTemplateVersionSummary {
  id: string;
  versionNo: number;
  status: PerformanceVersionStatus;
  sourceName: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface PerformanceTemplateListItem {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'CANCELLED';
  latestVersion: PerformanceTemplateVersionSummary | null;
  moduleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceTemplateDetail extends PerformanceTemplateListItem {
  versions: Array<PerformanceTemplateVersionSummary & {
    sourceMarkdown: string;
    definition: PerformanceTemplateDefinition;
  }>;
}

export interface PerformanceParseError {
  path: string;
  message: string;
}

export interface PerformanceTemplateParseResult {
  sourceName: string | null;
  sourceMarkdown: string;
  definition: PerformanceTemplateDefinition | null;
  errors: PerformanceParseError[];
}

export interface PerformanceDirectoryOption {
  id: string;
  code: string;
  name: string;
}

export interface PerformanceUserOption {
  id: string;
  username: string;
  displayName: string;
  employeeId: string | null;
}

export interface PerformanceOptions {
  users: PerformanceUserOption[];
  positions: PerformanceDirectoryOption[];
  jobTitles: PerformanceDirectoryOption[];
}

export interface PerformanceCycleListItem {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  templateName: string;
  templateVersionNo: number;
  status: ProcessStatus;
  instanceCount: number;
  completedInstanceCount: number;
  createdAt: string;
}

export interface PerformanceTaskListItem {
  id: string;
  cycleId: string;
  cycleName: string;
  instanceId: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  moduleId: string;
  moduleName: string;
  moduleType: PerformanceModuleType;
  moduleOrder: number;
  moduleWeight: number | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  executorName: string | null;
  isCurrent: boolean;
  canSubmit: boolean;
  completedAt: string | null;
}

export interface PerformanceTaskDetail extends PerformanceTaskListItem {
  moduleSnapshot: PerformanceModuleDefinition;
  rawData: unknown;
  calculationDetails: unknown;
  submission: { score?: number; adjustment?: number; comment?: string; attachmentIds?: string[] } | null;
  moduleScore: number | null;
  previousResults: Array<{ moduleName: string; moduleScore: number | null; rawData: unknown; calculationDetails: unknown; submission: unknown }>;
}

export interface PerformanceResultRevision {
  id: string;
  revisionNo: number;
  previousScore: number;
  nextScore: number;
  scoreDelta: number;
  previousAmount: number | null;
  nextAmount: number | null;
  reason: string;
  modifiedByName: string | null;
  modifiedAt: string;
}

export interface PerformanceResultListItem {
  id: string;
  cycleId: string;
  cycleName: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  finalScore: number | null;
  amountBaseSnapshot: number | null;
  actualAmount: number | null;
  status: ProcessStatus;
  revisionCount: number;
}

export interface PerformanceResultDetail extends PerformanceResultListItem {
  fixedWeightedScore: number | null;
  adjustmentScore: number;
  rawFinalScore: number | null;
  calculationFormula: string | null;
  moduleResults: Array<{ moduleName: string; moduleType: PerformanceModuleType; moduleWeight: number | null; moduleScore: number | null; details: unknown }>;
  revisions: PerformanceResultRevision[];
  definitionSnapshot: PerformanceTemplateDefinition;
}

export interface PerformanceDashboardSummary {
  templateCount: number;
  activeTaskCount: number;
  pendingResultCount: number;
}

export interface PerformanceAmountBase {
  id: string;
  versionNo: number;
  amount: number;
  previousAmount: number | null;
  effectiveAt: string;
  changedByName: string | null;
  changeReason: string;
  createdAt: string;
}

export interface PerformanceCreateTemplateInput {
  name: string;
  description?: string;
  sourceName?: string;
  sourceMarkdown: string;
  definition: PerformanceTemplateDefinition;
}

export interface PerformanceCreateCycleInput {
  name: string;
  periodStart: string;
  periodEnd: string;
  templateVersionId: string;
  employeeIds: string[];
}

export interface PerformanceTaskSubmissionInput {
  score?: number;
  adjustment?: number;
  comment?: string;
  attachmentIds?: string[];
}

export interface PerformanceResultModificationInput {
  finalScore: number;
  reason: string;
}

export interface PerformanceAmountBaseInput {
  amount: number;
  effectiveAt: string;
  reason: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  path?: string;
  timestamp?: string;
}

export interface TransferTypeListQuery {
  page?: number;
  pageSize?: number;
}

export interface TransferTypeListItem {
  id: string;
  name: string;
  displayOrder: null;
  effectiveDate: null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'CANCELLED';
}

export interface EmployeeRosterListQuery {
  keyword?: string;
  organizationId?: string;
  page?: number;
  pageSize?: number;
}

/** A single current-employment row in the HR employee roster. */
export interface EmployeeRosterListItem {
  id: string;
  name: string;
  workEmail: string | null;
  employeeNo: string;
  gender: string | null;
  birthDate: string | null;
  age: number | null;
  highestEducation: string | null;
  graduationSchoolName: string | null;
  graduationDate: string | null;
  major: string | null;
  mobile: string | null;
  documentNumber: string | null;
  personalEmail: string | null;
  nativePlace: string | null;
  householdAddress: string | null;
  householdType: null;
  ethnicity: string | null;
  maritalStatus: string | null;
  politicalStatus: string | null;
  partyLeagueJoinDate: null;
  workStartDate: null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactMobile: string | null;
  entryDate: string | null;
  assignmentStartDate: string | null;
  assignmentEndDate: string | null;
  departmentName: string | null;
  jobTitleName: string | null;
  positionName: string | null;
  jobLevel: JobLevel | null;
  managerName: string | null;
  managerEmail: string | null;
  personnelCategory: PersonnelCategory | null;
  serviceYears: number | null;
  workYears: null;
  workplaceName: string | null;
  employmentRelationship: EmploymentRelationship | null;
  employmentStatus: EmploymentStatus;
  hasProbation: boolean;
  probationStartDate: string | null;
  probationPlannedEndDate: string | null;
  probationMonths: number | null;
  confirmedDate: string | null;
  lastWorkingDate: null;
  organizationFullName: string | null;
  level1OrganizationName: string | null;
  level2OrganizationName: string | null;
  level3OrganizationName: string | null;
  agreementType: AgreementType | null;
  /** Current effective EmployeeAgreement.employingCompany.name. */
  fullTimeCompany: string | null;
  contractTermType: ContractTermType | null;
  contractEffectiveDate: string | null;
  contractEndDate: string | null;
  contractMonths: null;
  actualTerminationDate: string | null;
}

export interface ContractListQuery {
  keyword?: string;
  organizationId?: string;
  page?: number;
  pageSize?: number;
}

export interface ContractListItem {
  id: string;
  employeeNo: string;
  employeeName: string;
  departmentName: string | null;
  entryDate: string | null;
  fullTimeCompany: string | null;
  agreementType: AgreementType;
  termType: 'FIXED' | 'OPEN_ENDED';
  effectiveDate: string;
  endDate: string | null;
  latestElectronicSignatureStatus: null | string;
  latestElectronicAgreementAttachment: null | string;
  electronicSignatureRecords: null | string;
  contractRemark: null | string;
}
