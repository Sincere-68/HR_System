import type { AssignmentStatus } from '@prisma/client';
import type { PartTimeListItem } from '@hr-demo/shared';

interface PartTimePresentationRow {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date | null;
  status: AssignmentStatus;
  employee: {
    employeeNo: string;
    name: string | null;
  };
  organization: { name: string };
  jobTitle: { name: string } | null;
}

export function presentPartTime(
  row: PartTimePresentationRow,
  canViewEmployeeDetail = true,
): PartTimeListItem {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name ?? '--',
    employeeNo: row.employee.employeeNo,
    partTimeType: null,
    startDate: row.startDate.toISOString().slice(0, 10),
    institutionName: null,
    departmentName: row.organization.name,
    managerName: null,
    jobTitleName: row.jobTitle?.name ?? null,
    endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
    assignmentStatus: row.status,
    approvalStatus: null,
    canViewEmployeeDetail,
  };
}
