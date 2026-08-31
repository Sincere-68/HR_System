import type { BlacklistListItem } from '@hr-demo/shared';

export interface BlacklistListSnapshot {
  id: string;
  employeeId: string | null;
  name: string;
  documentNumber: string | null;
  mobile: string | null;
  reason: string;
  effectiveDate: Date;
  expiryDate: Date | null;
  employee: { workEmail: string | null } | null;
}

function formatDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function presentBlacklistListItem(
  record: BlacklistListSnapshot,
): BlacklistListItem {
  return {
    id: record.id,
    employeeId: record.employeeId,
    canViewEmployeeDetail: record.employeeId !== null,
    name: record.name,
    documentNumber: record.documentNumber,
    mobile: record.mobile,
    reason: record.reason,
    effectiveDate: formatDate(record.effectiveDate)!,
    expiryDate: formatDate(record.expiryDate),
    workEmail: record.employee?.workEmail ?? null,
  };
}
