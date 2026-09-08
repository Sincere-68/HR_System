import type { EmploymentStatus } from '@prisma/client';
import {
  displayChinaAdministrativeRegion,
  type EmployeeDetail,
  type EmployeeLevel,
  type EmployeeListItem,
  type EmploymentRelationship,
  type Gender,
  type IdentityDocumentType,
  type JobLevel,
  type PersonnelCategory,
  type PersonnelPosition,
  type PersonnelSource,
  type WorkArrangement,
} from '@hr-demo/shared';

export interface EmployeeWithCurrentRecord {
  id: string;
  employeeNo: string;
  name: string | null;
  mobile: string | null;
  idCardNo: string | null;
  organizationId: string | null;
  organization: { id?: string; code?: string; name: string } | null;
  assignments?: Array<{
    id?: string;
    organization: { id: string; code?: string; name: string };
    status?: 'ACTIVE' | 'ENDED';
    isPrimary: boolean;
    startDate: Date | null;
    endDate: Date | null;
  }>;
  employmentRecords: { status: EmploymentStatus }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeListSnapshot extends EmployeeWithCurrentRecord {
  gender: Gender | null;
  workEmail: string | null;
  personalEmail: string | null;
  birthDate: Date | null;
  nationality?: string | null;
  workStartDate?: Date | null;
  birthdayPreference?: string | null;
  lunarBirthDate?: Date | null;
  fullTimeDutyDescription?: string | null;
  partTimePositionName?: string | null;
  partTimeHourlyRate?: { toString(): string } | null;
  hasCompanyEquity?: boolean;
  importedWorkYears?: { toString(): string } | null;
  ethnicity: string | null;
  maritalStatus: string | null;
  politicalStatus: string | null;
  nativePlace: string | null;
  nativePlaceRegionName?: string | null;
  /** Legacy code is read only as fallback for pre-migration records. */
  nativePlaceRegionCode?: string | null;
  householdType?: string | null;
  householdRegionName?: string | null;
  /** Legacy code is read only as fallback for pre-migration records. */
  householdRegionCode?: string | null;
  householdAddress: string | null;
  residentialRegionName?: string | null;
  /** Legacy code is read only as fallback for pre-migration records. */
  residentialRegionCode?: string | null;
  residentialAddress: string | null;
  bankName?: string | null;
  bankBranchName?: string | null;
  bankAccountNumber?: string | null;
  employmentPeriods: Array<{
    personnelCategory?: PersonnelCategory | null;
    personnelSource?: PersonnelSource | null;
    employmentRelationship: EmploymentRelationship;
    entryDate: Date | null;
    actualExitDate: Date | null;
    agreements?: Array<{
      id?: string;
      employingCompanyId?: string | null;
      employingCompany: { id: string; code: string; name: string } | null;
    }>;
  }>;
  assignments: Array<{
    id?: string;
    organization: { id: string; code?: string; name: string };
    status: 'ACTIVE' | 'ENDED';
    positionId?: string | null;
    jobLevel?: JobLevel | null;
    workplaceName?: string | null;
    position: { id: string; name: string } | null;
    personnelPosition?: PersonnelPosition | null;
    employeeLevel?: EmployeeLevel | null;
    personnelCategory?: PersonnelCategory | null;
    employmentRelationship?: EmploymentRelationship | null;
    personnelSource?: PersonnelSource | null;
    workArrangement: WorkArrangement | string;
    confirmationDate?: Date | null;
    trialPostEndDate?: Date | null;
    movementTypeId?: string | null;
    movementType?: { id: string; name: string } | null;
    changeReason?: string | null;
    changeDescription?: string | null;
    isPrimary: boolean;
    startDate: Date | null;
    endDate: Date | null;
  }>;
  reportingAsEmployee: Array<{
    manager: { id?: string; name: string | null; workEmail: string | null };
    isPrimary: boolean;
    startDate: Date | null;
    endDate: Date | null;
  }>;
  identityDocuments: Array<{
    id?: string;
    documentType: IdentityDocumentType;
    documentNumber: string | null;
    expiryDate: Date | null;
    isPrimary: boolean;
  }>;
  familyMembers: Array<{
    id?: string;
    name: string | null;
    relationship: string;
    mobile: string | null;
    isEmergencyContact: boolean;
  }>;
  educationExperiences: Array<{
    id?: string;
    schoolName: string | null;
    educationLevel: string | null;
    institutionType?: string | null;
    major: string | null;
    graduationDate: Date | null;
    isHighestEducation: boolean;
  }>;
  workExperiences: Array<{
    startDate: Date | null;
    endDate: Date | null;
  }>;
  convertedCandidates: Array<{ source: string | null }>;
}

export function presentEmployee(
  employee: EmployeeWithCurrentRecord,
  visibleOrganizationIds?: readonly string[],
) {
  const currentRecord = employee.employmentRecords[0] ?? null;
  const assignments = employee.assignments ?? [];
  const allowedAssignments = visibleOrganizationIds
    ? assignments.filter((assignment) => visibleOrganizationIds.includes(assignment.organization.id))
    : assignments;
  const visibleAssignment = allowedAssignments.find((assignment) => assignment.isPrimary)
    ?? allowedAssignments[0]
    ?? null;
  const mayUseLegacyOrganization = Boolean(employee.organizationId && employee.organization)
    && assignments.length === 0
    && (!visibleOrganizationIds || visibleOrganizationIds.includes(employee.organizationId!));

  return {
    id: employee.id,
    employeeNo: employee.employeeNo,
    name: displayEmployeeName(employee.name),
    mobile: employee.mobile ?? '--',
    idCardNo: employee.idCardNo,
    organizationId: visibleAssignment?.organization.id
      ?? (mayUseLegacyOrganization ? employee.organizationId! : ''),
    organizationName: visibleAssignment?.organization.name
      ?? (mayUseLegacyOrganization ? employee.organization?.name ?? '' : ''),
    employmentStatus: currentRecord?.status ?? null,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}

/**
 * Demo mode has no relation records. Keep its API shape stable while marking
 * every relationship-backed personnel field as unavailable instead of
 * inventing database-only data.
 */
export function presentDemoEmployeeListItem(
  employee: EmployeeWithCurrentRecord,
  visibleOrganizationIds?: readonly string[],
): EmployeeListItem {
  const core = presentEmployee(employee, visibleOrganizationIds);
  const documentNumber = employee.idCardNo;
  return {
    ...core,
    entryDate: null,
    positionName: null,
    gender: null,
    personnelPosition: null,
    jobLevel: null,
    employeeLevel: null,
    workplaceName: null,
    workEmail: null,
    personalEmail: null,
    personnelCategory: null,
    personnelSource: null,
    fullTimeCompany: null,
    employmentRelationship: null,
    workArrangement: null,
    managerName: null,
    managerEmail: null,
    totalWorkYears: null,
    totalServiceYears: null,
    documentType: documentNumber ? 'NATIONAL_ID' : null,
    documentNumber,
    documentExpiryDate: null,
    birthDate: null,
    age: null,
    ethnicity: null,
    maritalStatus: null,
    politicalStatus: null,
    nativePlace: null,
    nativePlaceRegionName: null,
    householdType: null,
    householdRegionName: null,
    householdAddress: null,
    residentialRegionName: null,
    residentialAddress: null,
    emergencyContactName: null,
    emergencyContactRelationship: null,
    emergencyContactMobile: null,
    bankName: null,
    bankBranchName: null,
    bankAccountNumber: null,
    graduationSchoolName: null,
    institutionType: null,
    highestEducation: null,
    graduationDate: null,
    major: null,
  };
}

export function presentDemoEmployeeDetail(
  employee: EmployeeWithCurrentRecord,
  visibleOrganizationIds?: readonly string[],
): EmployeeDetail {
  return {
    ...presentDemoEmployeeListItem(employee, visibleOrganizationIds),
    assignmentId: null,
    positionId: null,
    agreementEmployingCompanyId: null,
    primaryDocumentId: null,
    emergencyContactId: null,
    highestEducationId: null,
    nationality: null,
    workStartDate: null,
    birthdayPreference: null,
    lunarBirthDate: null,
    fullTimeDutyDescription: null,
    partTimePositionName: null,
    partTimeHourlyRate: null,
    hasCompanyEquity: false,
    assignmentStartDate: null,
    confirmationDate: null,
    trialPostEndDate: null,
    movementTypeId: null,
    movementTypeName: null,
    changeReason: null,
    changeDescription: null,
    managerEmployeeId: null,
  };
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function yearsBetween(start: Date, end: Date) {
  const millisecondsPerYear = 365.2425 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round(((end.getTime() - start.getTime()) / millisecondsPerYear) * 100) / 100);
}

function sumExperienceYears(
  records: Array<{ startDate: Date | null; endDate: Date | null }>,
  now: Date,
) {
  const datedRecords = records.filter((record): record is { startDate: Date; endDate: Date | null } => (
    record.startDate !== null
  ));
  if (datedRecords.length === 0) return null;
  return Math.round(datedRecords.reduce(
    (total, record) => total + yearsBetween(record.startDate, record.endDate ?? now),
    0,
  ) * 100) / 100;
}

export function displayEmployeeName(value: string | null) {
  return value ?? '--';
}

function calculateAge(birthDate: Date | null, now: Date) {
  if (!birthDate) return null;
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < birthDate.getUTCMonth()
    || (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Keeps list pagination stable while putting the most recently onboarded employees first. */
export function sortEmployeeListByEntryDateDesc(rows: EmployeeListItem[]) {
  return [...rows].sort((left, right) => {
    const entryDateComparison = (right.entryDate ?? '').localeCompare(left.entryDate ?? '');
    if (entryDateComparison !== 0) return entryDateComparison;
    const employeeNoComparison = left.employeeNo.localeCompare(right.employeeNo);
    return employeeNoComparison !== 0 ? employeeNoComparison : left.id.localeCompare(right.id);
  });
}

export function presentEmployeeListItem(
  employee: EmployeeListSnapshot,
  now = new Date(),
  visibleOrganizationIds?: readonly string[],
): EmployeeListItem {

  const currentPeriod = employee.employmentPeriods.find((period) => period.entryDate !== null) ?? null;
  const currentAgreement = currentPeriod?.agreements?.[0] ?? null;
  const allowedAssignments = visibleOrganizationIds
    ? employee.assignments.filter((assignment) => visibleOrganizationIds.includes(assignment.organization.id))
    : employee.assignments;
  const currentAssignment = allowedAssignments.find((assignment) => assignment.isPrimary)
    ?? allowedAssignments[0]
    ?? null;
  const currentManager = currentAssignment
    ? (employee.reportingAsEmployee.find((relationship) => relationship.isPrimary)
      ?? employee.reportingAsEmployee[0]
      ?? null)
    : null;
  const primaryDocument = employee.identityDocuments.find((document) => document.isPrimary)
    ?? employee.identityDocuments[0]
    ?? null;
  const emergencyContact = employee.familyMembers.find((member) => member.isEmergencyContact) ?? null;
  const highestEducation = employee.educationExperiences.find((education) => education.isHighestEducation)
    ?? employee.educationExperiences[0]
    ?? null;

  return {
    ...presentEmployee(employee, visibleOrganizationIds),
    organizationId: currentAssignment?.organization.id ?? '',
    organizationName: currentAssignment?.organization.name ?? '',
    entryDate: formatDate(currentPeriod?.entryDate),
    positionName: currentAssignment?.position?.name ?? null,
    gender: employee.gender,
    personnelPosition: currentAssignment?.personnelPosition ?? null,
    jobLevel: currentAssignment?.jobLevel ?? null,
    employeeLevel: currentAssignment?.employeeLevel ?? null,
    workplaceName: currentAssignment?.workplaceName ?? null,
    workEmail: employee.workEmail,
    personalEmail: employee.personalEmail,
    personnelCategory: currentAssignment?.personnelCategory ?? currentPeriod?.personnelCategory ?? null,
    personnelSource: currentAssignment?.personnelSource ?? currentPeriod?.personnelSource ?? null,
    fullTimeCompany: currentAgreement?.employingCompany?.name ?? null,
    employmentRelationship: currentAssignment?.employmentRelationship ?? currentPeriod?.employmentRelationship ?? null,
    workArrangement: currentAssignment
      ? currentAssignment.workArrangement as WorkArrangement
      : null,
    managerName: currentManager?.manager.name ?? null,
    managerEmail: currentManager?.manager.workEmail ?? null,
    totalWorkYears: employee.importedWorkYears === null || employee.importedWorkYears === undefined
      ? sumExperienceYears(employee.workExperiences, now)
      : Math.round(((Number(employee.importedWorkYears.toString())
        + (sumExperienceYears(employee.workExperiences, now) ?? 0)) * 100)) / 100,
    totalServiceYears: sumExperienceYears(
      employee.employmentPeriods.map((period) => ({
        startDate: period.entryDate,
        endDate: period.actualExitDate,
      })),
      now,
    ),
    documentType: primaryDocument?.documentType ?? null,
    documentNumber: primaryDocument?.documentNumber ?? null,
    documentExpiryDate: formatDate(primaryDocument?.expiryDate),
    birthDate: formatDate(employee.birthDate),
    age: calculateAge(employee.birthDate, now),
    ethnicity: employee.ethnicity as EmployeeListItem['ethnicity'],
    maritalStatus: employee.maritalStatus as EmployeeListItem['maritalStatus'],
    politicalStatus: employee.politicalStatus as EmployeeListItem['politicalStatus'],
    nativePlace: employee.nativePlace,
    nativePlaceRegionName: displayChinaAdministrativeRegion(
      employee.nativePlaceRegionName,
      employee.nativePlaceRegionCode,
    ),
    householdType: employee.householdType as EmployeeListItem['householdType'] ?? null,
    householdRegionName: displayChinaAdministrativeRegion(
      employee.householdRegionName,
      employee.householdRegionCode,
    ),
    householdAddress: employee.householdAddress,
    residentialRegionName: displayChinaAdministrativeRegion(
      employee.residentialRegionName,
      employee.residentialRegionCode,
    ),
    residentialAddress: employee.residentialAddress,
    emergencyContactName: emergencyContact?.name ?? null,
    emergencyContactRelationship: emergencyContact?.relationship ?? null,
    emergencyContactMobile: emergencyContact?.mobile ?? null,
    bankName: employee.bankName as EmployeeListItem['bankName'] ?? null,
    bankBranchName: employee.bankBranchName ?? null,
    bankAccountNumber: employee.bankAccountNumber ?? null,
    graduationSchoolName: highestEducation?.schoolName ?? null,
    institutionType: highestEducation?.institutionType as EmployeeListItem['institutionType'] ?? null,
    highestEducation: highestEducation?.educationLevel as EmployeeListItem['highestEducation'] ?? null,
    graduationDate: formatDate(highestEducation?.graduationDate),
    major: highestEducation?.major ?? null,
  };
}

export function presentEmployeeDetail(
  employee: EmployeeListSnapshot,
  now = new Date(),
  visibleOrganizationIds?: readonly string[],
): EmployeeDetail {
  const item = presentEmployeeListItem(employee, now, visibleOrganizationIds);
  const allowedAssignments = visibleOrganizationIds
    ? employee.assignments.filter((assignment) => visibleOrganizationIds.includes(assignment.organization.id))
    : employee.assignments;
  const assignment = allowedAssignments.find((candidate) => candidate.isPrimary) ?? allowedAssignments[0] ?? null;
  const currentPeriod = employee.employmentPeriods.find((period) => period.entryDate !== null) ?? null;
  const currentAgreement = currentPeriod?.agreements?.[0] ?? null;
  const currentManager = assignment
    ? (employee.reportingAsEmployee.find((relationship) => relationship.isPrimary)
      ?? employee.reportingAsEmployee[0]
      ?? null)
    : null;
  const document = employee.identityDocuments.find((candidate) => candidate.isPrimary) ?? employee.identityDocuments[0] ?? null;
  const emergencyContact = employee.familyMembers.find((candidate) => candidate.isEmergencyContact) ?? null;
  const highestEducation = employee.educationExperiences.find((candidate) => candidate.isHighestEducation)
    ?? employee.educationExperiences[0]
    ?? null;

  return {
    ...item,
    assignmentId: assignment?.id ?? null,
    positionId: assignment?.position?.id ?? null,
    agreementEmployingCompanyId: currentAgreement?.employingCompany?.id ?? null,
    primaryDocumentId: document?.id ?? null,
    emergencyContactId: emergencyContact?.id ?? null,
    highestEducationId: highestEducation?.id ?? null,
    nationality: employee.nationality ?? null,
    workStartDate: formatDate(employee.workStartDate),
    birthdayPreference: employee.birthdayPreference === 'SOLAR' || employee.birthdayPreference === 'LUNAR'
      ? employee.birthdayPreference
      : null,
    lunarBirthDate: formatDate(employee.lunarBirthDate),
    fullTimeDutyDescription: employee.fullTimeDutyDescription ?? null,
    partTimePositionName: employee.partTimePositionName ?? null,
    partTimeHourlyRate: employee.partTimeHourlyRate?.toString() ?? null,
    hasCompanyEquity: employee.hasCompanyEquity ?? false,
    assignmentStartDate: formatDate(assignment?.startDate),
    confirmationDate: formatDate(assignment?.confirmationDate),
    trialPostEndDate: formatDate(assignment?.trialPostEndDate),
    movementTypeId: assignment?.movementTypeId ?? null,
    movementTypeName: assignment?.movementType?.name ?? null,
    changeReason: assignment?.changeReason ?? null,
    changeDescription: assignment?.changeDescription ?? null,
    managerEmployeeId: currentManager?.manager.id ?? null,
  };
}
