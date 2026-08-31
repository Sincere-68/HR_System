export interface PersonnelResignedPresenterRow {
  id: string;
  plannedLastWorkingDate: Date;
  actualLastWorkingDate: Date | null;
  reason: string | null;
  employee: {
    employeeNo: string;
    name: string;
    gender: string | null;
    mobile: string;
    identityDocuments: Array<{
      documentNumber: string;
      isPrimary: boolean;
    }>;
  };
  employmentPeriod: {
    entryDate: Date;
    assignments: Array<{
      organization: { name: string };
      position: { name: string } | null;
    }>;
    agreements: Array<{
      employingCompany: { name: string } | null;
    }>;
  } | null;
}

export interface PersonnelResignedListItem {
  id: string;
  employeeNo: string;
  name: string;
  departmentName: string | null;
  gender: string | null;
  entryDate: string | null;
  previousPositionName: string | null;
  terminationReason: string | null;
  movementType: null;
  lastWorkingDate: string;
  lastWorkingDateBasis: 'ACTUAL' | 'PLANNED';
  fullTimeCompany: string | null;
  documentNumber: string | null;
  mobile: string;
}

function formatDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

/** Maps one completed termination record to the personnel-page-specific row. */
export function presentPersonnelResigned(
  row: PersonnelResignedPresenterRow,
): PersonnelResignedListItem {
  const lastWorkingDate = row.actualLastWorkingDate ?? row.plannedLastWorkingDate;
  const assignment = row.employmentPeriod?.assignments[0] ?? null;
  const agreement = row.employmentPeriod?.agreements[0] ?? null;
  const document = row.employee.identityDocuments.find((candidate) => candidate.isPrimary)
    ?? row.employee.identityDocuments[0]
    ?? null;

  return {
    id: row.id,
    employeeNo: row.employee.employeeNo,
    name: row.employee.name,
    departmentName: assignment?.organization.name ?? null,
    gender: row.employee.gender,
    entryDate: formatDate(row.employmentPeriod?.entryDate ?? null),
    previousPositionName: assignment?.position?.name ?? null,
    terminationReason: row.reason,
    movementType: null,
    lastWorkingDate: lastWorkingDate.toISOString().slice(0, 10),
    lastWorkingDateBasis: row.actualLastWorkingDate ? 'ACTUAL' : 'PLANNED',
    fullTimeCompany: agreement?.employingCompany?.name ?? null,
    documentNumber: document?.documentNumber ?? null,
    mobile: row.employee.mobile,
  };
}
