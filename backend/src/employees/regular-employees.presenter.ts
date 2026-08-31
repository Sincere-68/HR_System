import type { Gender, JobLevel, WorkArrangement } from '@hr-demo/shared';

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
  resumeInfo: null;
  interviewEvaluation: null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankBranchName: string | null;
  fullTimeCompany: string | null;
}

export interface RegularEmployeeSnapshot {
  id: string;
  name: string;
  employeeNo: string;
  gender: Gender | null;
  workEmail: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankBranchName: string | null;
  employmentPeriods: Array<{
    entryDate: Date;
    assignments: Array<{
      organization: { name: string };
      position: { name: string } | null;
      jobLevel: JobLevel | null;
      workArrangement: WorkArrangement;
    }>;
    agreements: Array<{
      employingCompany: { name: string } | null;
    }>;
  }>;
  reportingAsEmployee: Array<{
    manager: { name: string };
  }>;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** Maps the already-filtered current-period, primary-assignment snapshot. */
export function presentRegularEmployee(
  employee: RegularEmployeeSnapshot,
  canViewEmployeeDetail: boolean,
): RegularEmployeeListItem {
  const period = employee.employmentPeriods[0];
  const assignment = period?.assignments[0];
  if (!period || !assignment) {
    throw new Error(`Regular employee ${employee.id} has no current primary assignment`);
  }

  return {
    employeeId: employee.id,
    canViewEmployeeDetail,
    name: employee.name,
    employeeNo: employee.employeeNo,
    entryDate: formatDate(period.entryDate),
    departmentName: assignment.organization.name,
    positionName: assignment.position?.name ?? null,
    jobLevel: assignment.jobLevel,
    gender: employee.gender,
    workEmail: employee.workEmail,
    workArrangement: assignment.workArrangement,
    managerName: employee.reportingAsEmployee[0]?.manager.name ?? null,
    resumeInfo: null,
    interviewEvaluation: null,
    bankName: employee.bankName,
    bankAccountNumber: employee.bankAccountNumber,
    bankBranchName: employee.bankBranchName,
    fullTimeCompany: period.agreements[0]?.employingCompany?.name ?? null,
  };
}
