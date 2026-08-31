import type { Gender } from '@prisma/client';
import type { RetirementListItem } from '@hr-demo/shared';

export interface RetirementSnapshot {
  id: string;
  employeeId: string;
  plannedRetirementDate: Date;
  employee: {
    employeeNo: string;
    name: string;
    gender: Gender | null;
    birthDate: Date | null;
  };
}

interface RetirementAssignmentSnapshot {
  organizationName: string;
  jobTitleName: string | null;
}

interface RetirementPresenterOptions {
  assignment: RetirementAssignmentSnapshot | null;
  canViewEmployeeDetail: boolean;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function calculateAgeOnDate(birthDate: Date, queryDate: Date) {
  let age = queryDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday = queryDate.getUTCMonth() < birthDate.getUTCMonth()
    || (queryDate.getUTCMonth() === birthDate.getUTCMonth()
      && queryDate.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return Math.max(0, age);
}

export function presentRetirement(
  row: RetirementSnapshot,
  options: RetirementPresenterOptions,
  queryDate = new Date(),
): RetirementListItem {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    employeeNo: row.employee.employeeNo,
    gender: row.employee.gender,
    age: row.employee.birthDate ? calculateAgeOnDate(row.employee.birthDate, queryDate) : null,
    birthDate: row.employee.birthDate ? formatDate(row.employee.birthDate) : null,
    plannedRetirementDate: formatDate(row.plannedRetirementDate),
    departmentName: options.assignment?.organizationName ?? null,
    jobTitleName: options.assignment?.jobTitleName ?? null,
    canViewEmployeeDetail: options.canViewEmployeeDetail,
  };
}
