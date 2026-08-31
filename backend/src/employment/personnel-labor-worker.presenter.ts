import type { WorkArrangement } from '@prisma/client';

/**
 * Personnel-page contract kept local until the parent integration adds the
 * shared package declaration. It is intentionally distinct from the
 * employment-management LaborWorkerListItem contract.
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

export interface PersonnelLaborWorkerPresentationRow {
  employeeId: string;
  entryDate: Date;
  employee: {
    employeeNo: string;
    name: string;
    workEmail: string | null;
  };
  /** The service limits this relation to the current effective primary assignment. */
  assignments: Array<{
    organization: { name: string };
    jobTitle: { name: string } | null;
    position: { name: string } | null;
    workArrangement: WorkArrangement;
  }>;
}

export interface PersonnelLaborWorkerPresenterOptions {
  managerName: string | null;
  canViewEmployeeDetail: boolean;
}

export function presentPersonnelLaborWorker(
  row: PersonnelLaborWorkerPresentationRow,
  options: PersonnelLaborWorkerPresenterOptions,
): PersonnelLaborWorkerListItem {
  const assignment = row.assignments[0];
  if (!assignment) {
    throw new Error('人员页劳务人员记录缺少当前主要任职');
  }

  return {
    name: row.employee.name,
    workEmail: row.employee.workEmail,
    employeeNo: row.employee.employeeNo,
    entryDate: row.entryDate.toISOString().slice(0, 10),
    departmentName: assignment.organization.name,
    jobTitleName: assignment.jobTitle?.name ?? null,
    positionName: assignment.position?.name ?? null,
    workArrangement: assignment.workArrangement,
    managerName: options.managerName,
    employeeId: row.employeeId,
    canViewEmployeeDetail: options.canViewEmployeeDetail,
  };
}
