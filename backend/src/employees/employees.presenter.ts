import type { EmploymentStatus } from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

interface EmployeeWithCurrentRecord {
  id: string;
  employeeNo: string;
  name: string;
  mobile: string;
  idCardNo: string;
  organizationId: string;
  organization: { name: string };
  employmentRecords: { status: EmploymentStatus }[];
  createdAt: Date;
  updatedAt: Date;
}

export function maskMobile(value: string) {
  return value.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

export function maskIdCard(value: string) {
  if (value.length <= 10) return '*'.repeat(value.length);
  return `${value.slice(0, 6)}${'*'.repeat(value.length - 10)}${value.slice(-4)}`;
}

export function presentEmployee(employee: EmployeeWithCurrentRecord, user: AuthenticatedUser) {
  const canReadSensitive = user.permissions.includes(PERMISSIONS.EMPLOYEE_SENSITIVE_READ);
  const currentRecord = employee.employmentRecords[0];
  if (!currentRecord) throw new Error(`Employee ${employee.id} has no current employment record`);

  return {
    id: employee.id,
    employeeNo: employee.employeeNo,
    name: employee.name,
    mobile: canReadSensitive ? employee.mobile : maskMobile(employee.mobile),
    idCardNo: canReadSensitive ? employee.idCardNo : maskIdCard(employee.idCardNo),
    organizationId: employee.organizationId,
    organizationName: employee.organization.name,
    employmentStatus: currentRecord.status,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}
