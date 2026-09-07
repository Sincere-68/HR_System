import type { AssignmentStatus, EmploymentStatus } from '@prisma/client';
import type { EmploymentRecordListItem } from '@hr-demo/shared';

export interface EmploymentRecordPresentationRow {
  id: string;
  employeeId: string;
  employmentPeriodId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: AssignmentStatus;
  isPrimary: boolean;
  employmentPeriod: {
    entryDate: Date | null;
    employmentRecords: Array<{
      status: EmploymentStatus;
      effectiveAt: Date;
      endedAt: Date | null;
    }>;
  } | null;
  employee: {
    employeeNo: string;
    name: string | null;
    employmentRecords: Array<{ status: EmploymentStatus }>;
    convertedCandidates: Array<{ resumeAttachmentId: string | null }>;
  };
  organization: { name: string };
  position: { name: string } | null;
}

interface EmploymentRecordPresentationOptions {
  isLatestPrimaryRecord: boolean;
  canViewEmployeeDetail: boolean;
}

export function presentEmploymentRecord(
  row: EmploymentRecordPresentationRow,
  options: EmploymentRecordPresentationOptions,
): EmploymentRecordListItem {
  const assignmentStartDate = row.startDate;
  let personnelRecord: { status: EmploymentStatus } | undefined;
  if (assignmentStartDate !== null && row.employmentPeriod) {
    personnelRecord = row.employmentPeriod.employmentRecords.find((record) => (
      record.effectiveAt <= assignmentStartDate
      && (record.endedAt === null || record.endedAt >= assignmentStartDate)
    ));
  }
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeNo: row.employee.employeeNo,
    employeeName: row.employee.name ?? '--',
    entryDate: row.employmentPeriod?.entryDate?.toISOString().slice(0, 10) ?? null,
    departmentName: row.organization.name,
    positionName: row.position?.name ?? null,
    positionStartDate: row.startDate?.toISOString().slice(0, 10) ?? null,
    positionEndDate: row.endDate?.toISOString().slice(0, 10) ?? null,
    personnelLocator: null,
    personnelStatus: personnelRecord?.status
      ?? (row.employmentPeriodId === null ? row.employee.employmentRecords[0]?.status : undefined)
      ?? null,
    assignmentStatus: row.status,
    approvalStatus: null,
    isLatestPrimaryRecord: options.isLatestPrimaryRecord,
    interviewEvaluation: null,
    availability: row.employee.convertedCandidates.some(({ resumeAttachmentId }) => resumeAttachmentId !== null)
      ? 'AVAILABLE'
      : null,
    canViewEmployeeDetail: options.canViewEmployeeDetail,
  };
}
