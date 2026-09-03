import type { ProcessStatus } from '@prisma/client';
import type { TrialPostListItem } from '@hr-demo/shared';

export interface TrialPostPresentationRow {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date | null;
  result: string | null;
  status: ProcessStatus;
  employee: { employeeNo: string; name: string | null };
  targetPosition: { organization: { id: string; name: string } | null };
}

export interface TrialPostPresentationOptions {
  canDisplayOrganization: (organizationId: string | null) => boolean;
  canViewEmployeeDetail: boolean;
}

export function presentTrialPost(
  row: TrialPostPresentationRow,
  options: TrialPostPresentationOptions,
): TrialPostListItem {
  const organization = row.targetPosition.organization;
  const canDisplayDepartment = options.canDisplayOrganization(organization?.id ?? null);

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeNo: row.employee.employeeNo,
    employeeName: row.employee.name ?? '--',
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
    movementTypeName: null,
    departmentName: canDisplayDepartment ? organization?.name ?? null : null,
    jobTitleName: null,
    result: row.result,
    status: row.status,
    canViewEmployeeDetail: options.canViewEmployeeDetail,
  };
}
