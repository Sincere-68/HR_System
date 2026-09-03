import type { LaborWorkerListItem, WorkArrangement } from '@hr-demo/shared';

export interface LaborWorkerPresentationRow {
  id: string;
  employeeId: string;
  entryDate: Date;
  employee: {
    employeeNo: string;
    name: string | null;
    workEmail: string | null;
  };
  assignments: Array<{
    organization: { name: string };
    jobTitle: { name: string } | null;
    workplace: { name: string } | null;
    workArrangement: WorkArrangement;
  }>;
}

export interface LaborWorkerPresenterOptions {
  managerName: string | null;
  canViewEmployeeDetail: boolean;
}

export function presentLaborWorker(
  row: LaborWorkerPresentationRow,
  options: LaborWorkerPresenterOptions,
): LaborWorkerListItem {
  const assignment = row.assignments[0];
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name ?? '--',
    workEmail: row.employee.workEmail,
    employeeNo: row.employee.employeeNo,
    entryDate: row.entryDate.toISOString().slice(0, 10),
    departmentName: assignment?.organization.name ?? null,
    jobTitleName: assignment?.jobTitle?.name ?? null,
    workArrangement: assignment?.workArrangement ?? null,
    managerName: options.managerName,
    workplaceName: assignment?.workplace?.name ?? null,
    canViewEmployeeDetail: options.canViewEmployeeDetail,
  };
}
