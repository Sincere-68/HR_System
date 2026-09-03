import {
  BANK_NAMES,
  EDUCATION_LEVELS,
  EMPLOYMENT_RELATIONSHIPS,
  ETHNICITIES,
  HOUSEHOLD_TYPES,
  INSTITUTION_TYPES,
  IDENTITY_DOCUMENT_TYPES,
  IDENTITY_DOCUMENT_TYPE_LABELS,
  JOB_LEVELS,
  MARITAL_STATUSES,
  EMPLOYEE_LEVELS,
  PERSONNEL_CATEGORIES,
  PERSONNEL_POSITIONS,
  PERSONNEL_SOURCES,
  POLITICAL_STATUSES,
  WORK_ARRANGEMENTS,
  type BankName,
  type EducationLevel,
  type EmploymentRelationship,
  type Ethnicity,
  type HouseholdType,
  type InstitutionType,
  type IdentityDocumentType,
  type JobLevel,
  type MaritalStatus,
  type EmployeeLevel,
  type PersonnelCategory,
  type PersonnelPosition,
  type PersonnelSource,
  type PoliticalStatus,
  type WorkArrangement,
} from '@hr-demo/shared';

export const personnelPositionLabels: Record<PersonnelPosition, string> = {
  FRONT_OFFICE: '前台',
  MIDDLE_OFFICE: '中台',
  BACK_OFFICE: '后台',
};

export const employeeLevelLabels: Record<EmployeeLevel, string> = {
  STAFF: '员工级',
  SUPERVISOR: '主管级',
  MANAGER: '经理级',
  DIRECTOR: '总监级',
  PRESIDENT: '总裁级',
  EXPERT: '专家级',
};

export const jobLevelLabels: Record<JobLevel, string> = Object.fromEntries(
  JOB_LEVELS.map((code) => [code, code]),
) as Record<JobLevel, string>;

export const personnelCategoryLabels: Record<PersonnelCategory, string> = {
  TALENT_PROGRAM: '创英计划',
  NON_TALENT_PROGRAM: '非创英计划',
};

export const employmentRelationshipLabels: Record<EmploymentRelationship, string> = {
  INTERNAL_EMPLOYEE: '内部员工',
  INTERN: '实习生',
  LABOR_WORKER: '劳务人员',
};

export const personnelSourceLabels: Record<PersonnelSource, string> = {
  SOCIAL_RECRUITMENT: '社会招聘',
  INTERNAL_REFERRAL: '内部推荐',
  HEADHUNTER_REFERRAL: '猎头推荐',
  OTHER: '其他',
};

export const workArrangementLabels: Record<WorkArrangement, string> = {
  PART_TIME: '兼职',
  LABOR_DISPATCH: '劳务派遣',
  CONTRACT_EMPLOYMENT: '合同用工',
  LABOR_EMPLOYMENT: '劳务用工',
  INTERN: '实习生',
  RETIREE_REEMPLOYMENT: '退休返聘',
};

export const householdTypeLabels: Record<HouseholdType, string> = {
  LOCAL_RURAL: '本地农村',
  LOCAL_URBAN: '本地城镇',
  NONLOCAL_RURAL: '外地农村',
  NONLOCAL_URBAN: '外地城镇',
};

export const bankNameLabels: Record<BankName, string> = { ICBC: '中国工商银行' };

export const identityDocumentTypeLabels: Record<IdentityDocumentType, string> = IDENTITY_DOCUMENT_TYPE_LABELS;

export const educationLevelLabels: Record<EducationLevel, string> = {
  DOCTORAL: '博士研究生', MASTER: '硕士研究生', MBA: 'MBA', BACHELOR: '本科',
  DUAL_BACHELOR: '本科双学位', ASSOCIATE_DEGREE: '大专',
  OVERSEAS_HIGHER_EDUCATION: '海外高校', SECONDARY_TECHNICAL: '中技(中专/技校/职高)',
  HIGH_SCHOOL: '高中', JUNIOR_HIGH_OR_BELOW: '初中及以下',
};

export const institutionTypeLabels: Record<InstitutionType, string> = {
  RANK_985: '985', RANK_211: '211', OVERSEAS_TOP_200: '海外QS/U.S.News排名Top200',
  OVERSEAS_BEYOND_TOP_100: '海外排名Top100外', NATIONAL_UNIFIED_BACHELOR: '统招本科（含一本、二本）',
  THIRD_TIER_OR_PRIVATE_BACHELOR: '统招三本&统招民办本科',
  NON_UNIFIED_BACHELOR: '非统招本科（自考本科、成人高考、专升本、其他）',
};

export const maritalStatusLabels: Record<MaritalStatus, string> = {
  UNMARRIED: '未婚', MARRIED: '已婚', DIVORCED: '离异', WIDOWED: '丧偶',
};

export const politicalStatusLabels: Record<PoliticalStatus, string> = {
  NON_PARTY: '群众', CPC_MEMBER: '中共党员', CPC_PROBATIONARY_MEMBER: '中共预备党员',
  CYL_MEMBER: '共青团员', CDF_MEMBER: '民革党员', CDL_MEMBER: '民盟盟员',
  CDCA_MEMBER: '民建会员', CAPD_MEMBER: '民进会员', CPWDP_MEMBER: '农工党党员',
  ZGD_MEMBER: '致公党党员', JDS_MEMBER: '九三学社社员', TML_MEMBER: '台盟盟员',
  NONPARTISAN: '无党派人士', OTHER: '其他',
};

const ethnicityNames = [
  '汉族','回族','畲族','塔塔尔族','阿昌族','哈萨克族','土家族','景颇族','哈尼族','土族',
  '白族','维吾尔族','保安族','赫哲族','乌孜别克族','基诺族','布依族','拉祜族','锡伯族','黎族',
  '东乡族','蒙古族','仫佬族','达斡尔族','藏族','毛南族','裕固族','俄罗斯族','德昂族','傈僳族',
  '瑶族','朝鲜族','布朗族','满族','彝族','门巴族','侗族','苗族','佤族','羌族','独龙族','怒族',
  '珞巴族','普米族','傣族','纳西族','高山族','壮族','鄂伦春族','塔吉克族','京族','仡佬族',
  '鄂温克族','撒拉族','柯尔克孜族','水族','穿青人','其他','革族','革家人',
] as const;
export const ethnicityLabels = Object.fromEntries(
  ETHNICITIES.map((code, index) => [code, ethnicityNames[index]]),
) as Record<Ethnicity, string>;

export function enumOptions<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((value) => ({ value, label: labels[value] }));
}

export const personnelPositionOptions = enumOptions(PERSONNEL_POSITIONS, personnelPositionLabels);
export const employeeLevelOptions = enumOptions(EMPLOYEE_LEVELS, employeeLevelLabels);
export const jobLevelOptions = enumOptions(JOB_LEVELS, jobLevelLabels);
export const personnelCategoryOptions = enumOptions(PERSONNEL_CATEGORIES, personnelCategoryLabels);
export const employmentRelationshipOptions = enumOptions(EMPLOYMENT_RELATIONSHIPS, employmentRelationshipLabels);
export const personnelSourceOptions = enumOptions(PERSONNEL_SOURCES, personnelSourceLabels);
export const workArrangementOptions = enumOptions(WORK_ARRANGEMENTS, workArrangementLabels);
export const householdTypeOptions = enumOptions(HOUSEHOLD_TYPES, householdTypeLabels);
export const bankNameOptions = enumOptions(BANK_NAMES, bankNameLabels);
export const identityDocumentTypeOptions = enumOptions(IDENTITY_DOCUMENT_TYPES, identityDocumentTypeLabels);
export const educationLevelOptions = enumOptions(EDUCATION_LEVELS, educationLevelLabels);
export const institutionTypeOptions = enumOptions(INSTITUTION_TYPES, institutionTypeLabels);
export const maritalStatusOptions = enumOptions(MARITAL_STATUSES, maritalStatusLabels);
export const politicalStatusOptions = enumOptions(POLITICAL_STATUSES, politicalStatusLabels);
export const ethnicityOptions = enumOptions(ETHNICITIES, ethnicityLabels);
