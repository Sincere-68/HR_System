import type { ProcessStatus } from '@prisma/client';
import type { TerminationListItem } from '@hr-demo/shared';

export interface TerminationPresenterRow {
  id: string;
  employeeId: string;
  plannedLastWorkingDate: Date;
  actualLastWorkingDate: Date | null;
  terminationType: string;
  reason: string | null;
  status: ProcessStatus;
  employee: { employeeNo: string; name: string };
  handoverCase: { archivedAt: Date | null; status: ProcessStatus } | null;
  approvalRequest: {
    archivedAt: Date | null;
    status: ProcessStatus;
    currentStep: number;
    steps: Array<{ stepOrder: number; approver: { displayName: string } }>;
  } | null;
}

interface AssignmentDisplay {
  organizationName: string | null;
  positionName: string | null;
}

interface PresentTerminationOptions {
  assignment: AssignmentDisplay | null;
  canViewEmployeeDetail: boolean;
}

export function presentTermination(
  row: TerminationPresenterRow,
  options: PresentTerminationOptions,
): TerminationListItem {
  const lastWorkingDate = row.actualLastWorkingDate ?? row.plannedLastWorkingDate;
  const approvalRequest = row.approvalRequest?.archivedAt ? null : row.approvalRequest;
  const hasCurrentApprovalStep = approvalRequest?.status === 'PENDING'
    || approvalRequest?.status === 'IN_PROGRESS';
  const currentApprover = hasCurrentApprovalStep
    ? approvalRequest?.steps.find((step) => step.stepOrder === approvalRequest.currentStep)
    : undefined;
  const handoverCase = row.handoverCase?.archivedAt ? null : row.handoverCase;

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeNo: row.employee.employeeNo,
    employeeName: row.employee.name,
    previousDepartmentName: options.assignment?.organizationName ?? null,
    previousPositionName: options.assignment?.positionName ?? null,
    lastWorkingDate: lastWorkingDate.toISOString().slice(0, 10),
    lastWorkingDateBasis: row.actualLastWorkingDate ? 'ACTUAL' : 'PLANNED',
    terminationType: row.terminationType,
    terminationReason: row.reason,
    approvalStatus: approvalRequest?.status ?? null,
    currentApproverName: currentApprover?.approver.displayName ?? null,
    handoverStatus: handoverCase?.status ?? null,
    compensationAmount: null,
    canViewEmployeeDetail: options.canViewEmployeeDetail,
  };
}
