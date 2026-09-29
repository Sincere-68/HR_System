import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApprovalDecision,
  AssignmentStatus,
  EmploymentRelationship,
  EmploymentStatus,
  ProcessStatus,
  RecordStatus,
  WorkArrangement,
} from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AccessControlService } from '../access-control/access-control.service';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 86_400_000;
const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED];
const ACTIVE_APPROVAL_STATUSES: ProcessStatus[] = [ProcessStatus.PENDING, ProcessStatus.IN_PROGRESS];
const PROBATION_APPROVAL_BUSINESS_TYPE = 'PROBATION_REGULARIZATION';

function calendarDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function formatDate(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function formatDateTime(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

@Injectable()
export class EmploymentDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly demo: DemoDataService,
  ) {}

  async getEmploymentRecordDetail(user: AuthenticatedUser, id: string) {
    this.assertReadPermission(user);
    this.assertId(id);
    if (this.demo.enabled) return this.notFound('任职记录');

    const row = await this.prisma.employeeAssignment.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        employmentPeriodId: true,
        organizationId: true,
        jobLevel: true,
        assignmentType: true,
        workArrangement: true,
        startDate: true,
        endDate: true,
        status: true,
        isPrimary: true,
        archivedAt: true,
        employee: {
          select: {
            employeeNo: true,
            name: true,
            archivedAt: true,
            recordStatus: true,
            convertedCandidates: { where: { archivedAt: null }, select: { resumeAttachmentId: true } },
          },
        },
        employmentPeriod: {
          select: {
            id: true,
            sequenceNo: true,
            entryDate: true,
            actualExitDate: true,
            employmentRelationship: true,
            employmentRecords: {
              select: { status: true, effectiveAt: true, endedAt: true },
              orderBy: [{ effectiveAt: 'desc' }, { id: 'asc' }],
            },
          },
        },
        organization: { select: { id: true, code: true, name: true } },
        position: { select: { id: true, name: true } },
        jobTitle: { select: { name: true } },
      },
    });
    if (!row || !this.activeEmployee(row.employee)) return this.notFound('任职记录');
    await this.assertHistoricalOrganizationAccess(user, row.organizationId, row.startDate);

    const personnelRecord = row.startDate
      ? row.employmentPeriod?.employmentRecords.find((record) => (
        record.effectiveAt <= row.startDate!
        && (!record.endedAt || record.endedAt >= row.startDate!)
      ))
      : undefined;
    const canViewEmployeeDetail = await this.canViewCurrentEmployeeDetail(user, row.employeeId);
    const latestPrimary = await this.findLatestPrimaryHistoricalAssignment(
      user,
      row.employeeId,
      row.employmentPeriodId,
    );

    return {
      id: row.id,
      employeeId: row.employeeId,
      employeeNo: row.employee.employeeNo,
      employeeName: row.employee.name ?? '--',
      employmentPeriod: row.employmentPeriod
        ? {
            id: row.employmentPeriod.id,
            sequenceNo: row.employmentPeriod.sequenceNo,
            entryDate: formatDate(row.employmentPeriod.entryDate),
            actualExitDate: formatDate(row.employmentPeriod.actualExitDate),
            employmentRelationship: row.employmentPeriod.employmentRelationship,
          }
        : null,
      organization: row.organization,
      position: row.position,
      jobTitleName: row.jobTitle?.name ?? null,
      jobLevel: row.jobLevel,
      assignmentType: row.assignmentType,
      workArrangement: row.workArrangement,
      positionStartDate: formatDate(row.startDate),
      positionEndDate: formatDate(row.endDate),
      assignmentStatus: row.status,
      personnelStatus: personnelRecord?.status ?? null,
      approvalStatus: null,
      isPrimary: row.isPrimary,
      isLatestPrimaryRecord: row.isPrimary && latestPrimary?.id === row.id,
      personnelLocator: null,
      interviewEvaluation: null,
      availability: row.employee.convertedCandidates.some(({ resumeAttachmentId }) => resumeAttachmentId !== null)
        ? 'AVAILABLE'
        : null,
      canViewEmployeeDetail,
    };
  }

  async getProbationDetail(user: AuthenticatedUser, id: string) {
    this.assertReadPermission(user);
    this.assertId(id);
    if (this.demo.enabled) return this.notFound('试用记录');

    const row = await this.prisma.probationRecord.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        employmentPeriodId: true,
        startDate: true,
        plannedEndDate: true,
        probationMonths: true,
        actualEndDate: true,
        evaluationType: true,
        result: true,
        evaluation: true,
        confirmedDate: true,
        extensionCount: true,
        status: true,
        archivedAt: true,
        employee: { select: { employeeNo: true, name: true, archivedAt: true, recordStatus: true } },
        employmentPeriod: {
          select: {
            id: true,
            sequenceNo: true,
            employmentRelationship: true,
            employmentStatus: true,
            entryDate: true,
            actualExitDate: true,
          },
        },
      },
    });
    if (!row || row.archivedAt || !this.activeEmployee(row.employee)) return this.notFound('试用记录');
    const assignment = await this.findHistoricalAssignment(
      user,
      row.employeeId,
      row.employmentPeriodId,
      row.startDate,
    );
    if (!assignment) return this.notFound('试用记录');

    const approval = await this.findApproval(id, PROBATION_APPROVAL_BUSINESS_TYPE);
    const currentStep = approval?.steps.find((step) => step.stepOrder === approval.currentStep);
    const canViewEmployeeDetail = await this.canViewCurrentEmployeeDetail(user, row.employeeId);
    const today = calendarDay(new Date());
    return {
      id: row.id,
      employee: {
        id: row.employeeId,
        employeeNo: row.employee.employeeNo,
        name: row.employee.name ?? '--',
        canViewEmployeeDetail,
      },
      employmentPeriod: row.employmentPeriod
        ? {
            id: row.employmentPeriod.id,
            sequenceNo: row.employmentPeriod.sequenceNo,
            employmentRelationship: row.employmentPeriod.employmentRelationship,
            employmentStatus: row.employmentPeriod.employmentStatus,
            entryDate: formatDate(row.employmentPeriod.entryDate),
            actualExitDate: formatDate(row.employmentPeriod.actualExitDate),
          }
        : null,
      probation: {
        startDate: formatDate(row.startDate),
        plannedEndDate: formatDate(row.plannedEndDate),
        probationMonths: row.probationMonths,
        actualEndDate: formatDate(row.actualEndDate),
        evaluationType: row.evaluationType === 'IN_PROBATION' || row.evaluationType === 'REGULARIZATION'
          ? row.evaluationType
          : null,
        evaluationName: this.probationEvaluationName(row.evaluationType),
        evaluation: row.evaluation,
        result: row.result,
        confirmedDate: formatDate(row.confirmedDate),
        extensionCount: row.extensionCount,
        status: row.status,
        daysUntilPlannedEnd: Math.round((row.plannedEndDate.getTime() - today.getTime()) / DAY_MS),
      },
      assignmentAtStart: {
        organizationId: assignment.organizationId,
        organizationName: assignment.organization.name,
        positionName: assignment.position?.name ?? null,
        jobTitleName: assignment.jobTitle?.name ?? null,
        startDate: formatDate(assignment.startDate),
        endDate: formatDate(assignment.endDate),
      },
      approval: approval
        ? {
            id: approval.id,
            status: approval.status,
            currentStep: approval.currentStep,
            currentApproverName: currentStep?.approver.displayName ?? null,
            submittedAt: formatDateTime(approval.submittedAt),
            completedAt: formatDateTime(approval.completedAt),
          }
        : null,
      permissions: {
        canViewEmployeeDetail,
        canManage: canViewEmployeeDetail && this.access.hasPermission(user, 'employee.update'),
        canRemindApproval: canViewEmployeeDetail && approval?.status === ProcessStatus.PENDING && Boolean(currentStep),
        canTransferApproval: canViewEmployeeDetail && approval?.status === ProcessStatus.PENDING && currentStep?.approverUserId === user.id,
      },
    };
  }

  async getMovementDetail(user: AuthenticatedUser, id: string) {
    this.assertReadPermission(user);
    this.assertId(id);
    if (this.demo.enabled) return this.notFound('异动');
    const row = await this.prisma.employeeMovement.findUnique({
      where: { id },
      select: {
        id: true, employeeId: true, effectiveDate: true, reason: true, status: true,
        fromOrganizationId: true, toOrganizationId: true, fromPositionId: true, toPositionId: true,
        fromJobLevel: true, toJobLevel: true, createdAt: true, updatedAt: true, archivedAt: true,
        employee: { select: { employeeNo: true, name: true, archivedAt: true, recordStatus: true } },
        movementType: { select: { id: true, name: true, status: true, archivedAt: true } },
        fromOrganization: { select: { id: true, name: true } }, toOrganization: { select: { id: true, name: true } },
        fromPosition: { select: { id: true, name: true, organizationId: true } }, toPosition: { select: { id: true, name: true, organizationId: true } },
        approvalRequest: {
          where: { archivedAt: null },
          select: {
            id: true, status: true, currentStep: true, submittedAt: true, completedAt: true,
            steps: { orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }], select: { stepOrder: true, decision: true, comment: true, operatedAt: true, approver: { select: { displayName: true } } } },
          },
        },
      },
    });
    if (!row || row.archivedAt || !this.activeEmployee(row.employee) || row.movementType.archivedAt) return this.notFound('异动');
    const hasHistoricalAssignment = await this.hasHistoricalAssignment(user, row.employeeId, null, row.effectiveDate, [row.fromOrganizationId, row.toOrganizationId]);
    if (!hasHistoricalAssignment) return this.notFound('异动');
    const accessible = await this.access.getAccessibleOrganizationIds(user);
    const all = this.access.hasAllEmployeeData(user);
    const canDisplay = (orgId: string | null) => all || Boolean(orgId && accessible?.includes(orgId));
    const canViewEmployeeDetail = await this.canViewCurrentEmployeeDetail(user, row.employeeId);
    return {
      id: row.id,
      employeeId: row.employeeId,
      employee: { employeeNo: row.employee.employeeNo, name: row.employee.name ?? '--', canViewEmployeeDetail },
      effectiveDate: formatDate(row.effectiveDate),
      movementType: { id: row.movementType.id, name: row.movementType.name },
      reason: row.reason,
      movementStatus: row.status,
      approval: row.approvalRequest ? {
        id: row.approvalRequest.id,
        status: row.approvalRequest.status,
        currentStep: ACTIVE_APPROVAL_STATUSES.includes(row.approvalRequest.status) ? row.approvalRequest.currentStep : null,
        steps: row.approvalRequest.steps.map((step) => ({ stepOrder: step.stepOrder, approverName: step.approver.displayName, decision: step.decision, operatedAt: formatDateTime(step.operatedAt), comment: step.comment })),
      } : null,
      from: canDisplay(row.fromOrganizationId) ? {
        organizationId: row.fromOrganizationId, organizationName: row.fromOrganization?.name ?? null,
        positionId: row.fromPositionId, positionName: row.fromPosition && (!row.fromPosition.organizationId || row.fromPosition.organizationId === row.fromOrganizationId) ? row.fromPosition.name : null,
        jobLevel: row.fromJobLevel,
      } : { organizationId: null, organizationName: null, positionId: null, positionName: null, jobLevel: null },
      to: canDisplay(row.toOrganizationId) ? {
        organizationId: row.toOrganizationId, organizationName: row.toOrganization?.name ?? null,
        positionId: row.toPositionId, positionName: row.toPosition && (!row.toPosition.organizationId || row.toPosition.organizationId === row.toOrganizationId) ? row.toPosition.name : null,
        jobLevel: row.toJobLevel,
      } : { organizationId: null, organizationName: null, positionId: null, positionName: null, jobLevel: null },
      toWorkplaceName: null,
      handoverStatus: null,
      trialPostEndDate: null,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    };
  }

  async getTrialPostDetail(user: AuthenticatedUser, id: string) {
    this.assertReadPermission(user);
    this.assertId(id);
    if (this.demo.enabled) return this.notFound('试岗记录');
    const row = await this.prisma.trialPostRecord.findUnique({
      where: { id },
      select: {
        id: true, employeeId: true, startDate: true, endDate: true, result: true, status: true, comment: true, createdAt: true, updatedAt: true, archivedAt: true,
        employee: { select: { employeeNo: true, name: true, archivedAt: true, recordStatus: true } },
        targetPosition: { select: { id: true, name: true, organization: { select: { id: true, name: true } } } },
        evaluator: { select: { displayName: true } },
      },
    });
    if (!row || row.archivedAt || !this.activeEmployee(row.employee)) return this.notFound('试岗记录');
    const canDisplay = await this.canAccessOrganization(user, row.targetPosition.organization?.id ?? null);
    if (!canDisplay) return this.notFound('试岗记录');
    const canViewEmployeeDetail = await this.canViewCurrentEmployeeDetail(user, row.employeeId);
    return {
      id: row.id, employeeId: row.employeeId,
      employee: { employeeNo: row.employee.employeeNo, name: row.employee.name ?? '--', canViewEmployeeDetail },
      targetPosition: { id: row.targetPosition.id, name: row.targetPosition.name, organizationId: row.targetPosition.organization?.id ?? null, organizationName: row.targetPosition.organization?.name ?? null },
      startDate: formatDate(row.startDate), endDate: formatDate(row.endDate), status: row.status, result: row.result,
      evaluator: row.evaluator ? { name: row.evaluator.displayName } : null,
      comment: row.comment, canViewEmployeeDetail, createdAt: formatDateTime(row.createdAt), updatedAt: formatDateTime(row.updatedAt),
    };
  }

  async getInternDetail(user: AuthenticatedUser, id: string) {
    return this.getEmploymentPeriodDetail(user, id, EmploymentRelationship.INTERN, '实习业务记录');
  }

  async getLaborWorkerDetail(user: AuthenticatedUser, id: string) {
    return this.getEmploymentPeriodDetail(user, id, EmploymentRelationship.LABOR_WORKER, '劳务业务记录');
  }

  async getTerminationDetail(user: AuthenticatedUser, id: string) {
    this.assertReadPermission(user);
    this.assertId(id);
    if (this.demo.enabled) return this.notFound('离职记录');
    const row = await this.prisma.terminationRecord.findUnique({
      where: { id },
      select: {
        id: true, employeeId: true, employmentPeriodId: true, applicationDate: true, plannedLastWorkingDate: true, actualLastWorkingDate: true,
        terminationType: true, reason: true, rehireEligible: true, status: true, updatedAt: true, archivedAt: true,
        employee: { select: { employeeNo: true, name: true, archivedAt: true, recordStatus: true } },
        approvalRequest: { where: { archivedAt: null }, select: { id: true, status: true, currentStep: true, steps: { orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }], select: { stepOrder: true, decision: true, comment: true, operatedAt: true, approver: { select: { displayName: true } } } } } },
        handoverCase: { where: { archivedAt: null }, select: { id: true, status: true, plannedDate: true, completedDate: true, ownerUser: { select: { displayName: true } }, items: { select: { id: true, itemType: true, itemName: true, description: true, confirmationStatus: true, confirmedAt: true, remark: true } } } },
      },
    });
    if (!row || row.archivedAt || !this.activeEmployee(row.employee)) return this.notFound('离职记录');
    const lastDate = row.actualLastWorkingDate ?? row.plannedLastWorkingDate;
    const assignment = await this.findHistoricalAssignment(user, row.employeeId, row.employmentPeriodId, lastDate);
    if (!assignment) return this.notFound('离职记录');
    const canViewEmployeeDetail = await this.canViewCurrentEmployeeDetail(user, row.employeeId);
    return {
      id: row.id, employeeId: row.employeeId, employeeNo: row.employee.employeeNo, employeeName: row.employee.name ?? '--', employmentPeriodId: row.employmentPeriodId,
      applicationDate: formatDate(row.applicationDate), plannedLastWorkingDate: formatDate(row.plannedLastWorkingDate), actualLastWorkingDate: formatDate(row.actualLastWorkingDate),
      lastWorkingDate: formatDate(lastDate), lastWorkingDateBasis: row.actualLastWorkingDate ? 'ACTUAL' : 'PLANNED', terminationType: row.terminationType, terminationReason: row.reason, rehireEligible: row.rehireEligible, status: row.status,
      approval: row.approvalRequest ? this.presentApproval(row.approvalRequest) : null,
      handover: row.handoverCase ? { id: row.handoverCase.id, status: row.handoverCase.status, plannedDate: formatDate(row.handoverCase.plannedDate), completedDate: formatDate(row.handoverCase.completedDate), ownerName: row.handoverCase.ownerUser?.displayName ?? null, items: row.handoverCase.items.map((item) => ({ ...item, confirmedAt: formatDateTime(item.confirmedAt) })) } : null,
      compensationAmount: null,
      historicalAssignment: this.presentAssignment(assignment),
      canViewEmployeeDetail, canViewEmploymentHistory: canViewEmployeeDetail, updatedAt: formatDateTime(row.updatedAt),
    };
  }

  async getRetirementDetail(user: AuthenticatedUser, id: string) {
    this.assertReadPermission(user);
    this.assertId(id);
    if (this.demo.enabled) return this.notFound('退休记录');
    const row = await this.prisma.retirementRecord.findUnique({
      where: { id },
      select: {
        id: true, employeeId: true, employmentPeriodId: true, plannedRetirementDate: true, actualRetirementDate: true, retirementType: true, pensionHandlingStatus: true, remark: true, status: true, archivedAt: true,
        employee: { select: { employeeNo: true, name: true, archivedAt: true, recordStatus: true } },
      },
    });
    if (!row || row.archivedAt || !this.activeEmployee(row.employee)) return this.notFound('退休记录');
    const date = row.actualRetirementDate ?? row.plannedRetirementDate;
    const assignment = await this.findHistoricalAssignment(user, row.employeeId, row.employmentPeriodId, date);
    if (!assignment) return this.notFound('退休记录');
    const canViewEmployeeDetail = await this.canViewCurrentEmployeeDetail(user, row.employeeId);
    return {
      id: row.id, employeeId: row.employeeId, employeeNo: row.employee.employeeNo, employeeName: row.employee.name ?? '--', employmentPeriodId: row.employmentPeriodId,
      plannedRetirementDate: formatDate(row.plannedRetirementDate), actualRetirementDate: formatDate(row.actualRetirementDate), retirementBusinessDate: formatDate(date), retirementBusinessDateBasis: row.actualRetirementDate ? 'ACTUAL' : 'PLANNED', retirementType: row.retirementType, pensionHandlingStatus: row.pensionHandlingStatus, remark: row.remark, status: row.status,
      historicalAssignment: this.presentAssignment(assignment), canViewEmployeeDetail, canViewEmploymentHistory: canViewEmployeeDetail,
    };
  }

  async getPartTimeDetail(user: AuthenticatedUser, id: string) {
    this.assertReadPermission(user);
    this.assertId(id);
    if (this.demo.enabled) return this.notFound('兼职任职记录');
    const row = await this.prisma.employeeAssignment.findUnique({
      where: { id },
      select: {
        id: true, employeeId: true, organizationId: true, positionId: true, jobTitleId: true, workplaceName: true, workArrangement: true, assignmentType: true, isPrimary: true, startDate: true, endDate: true, status: true, archivedAt: true,
        employee: { select: { employeeNo: true, name: true, archivedAt: true, recordStatus: true } }, organization: { select: { id: true, name: true } }, position: { select: { id: true, name: true } }, jobTitle: { select: { id: true, name: true } },
      },
    });
    if (!row || row.archivedAt || row.workArrangement !== WorkArrangement.PART_TIME || !this.activeEmployee(row.employee)) return this.notFound('兼职任职记录');
    if (!(await this.canAccessOrganization(user, row.organizationId))) return this.notFound('兼职任职记录');
    const canViewCurrentEmployeeDetail = await this.canViewCurrentEmployeeDetail(user, row.employeeId);
    return {
      id: row.id, employeeId: row.employeeId, employeeNo: row.employee.employeeNo, employeeName: row.employee.name ?? '--',
      assignment: { organizationId: row.organization.id, departmentName: row.organization.name, positionId: row.position?.id ?? row.positionId, jobTitleName: row.jobTitle?.name ?? null, workplaceName: row.workplaceName, workArrangement: row.workArrangement, assignmentType: row.assignmentType, isPrimary: row.isPrimary, startDate: formatDate(row.startDate), endDate: formatDate(row.endDate), status: row.status },
      partTimeType: null, institutionName: null, managerName: null, approvalStatus: null, canViewCurrentEmployeeDetail,
    };
  }

  private async getEmploymentPeriodDetail(user: AuthenticatedUser, id: string, relationship: EmploymentRelationship, label: string) {
    this.assertReadPermission(user);
    this.assertId(id);
    if (this.demo.enabled) return this.notFound(label);
    const row = await this.prisma.employmentPeriod.findUnique({
      where: { id },
      select: {
        id: true, employeeId: true, sequenceNo: true, employmentRelationship: true, entryDate: true, plannedExitDate: true, actualExitDate: true, employmentStatus: true, isRehire: true, previousPeriodId: true, status: true, archivedAt: true,
        employee: { select: { employeeNo: true, name: true, workEmail: true, archivedAt: true, recordStatus: true } },
        assignments: { where: { archivedAt: null, status: { in: ACTIVE_ASSIGNMENT_STATUSES } }, orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }], select: { id: true, organizationId: true, positionId: true, jobTitleId: true, jobLevel: true, workplaceName: true, workArrangement: true, assignmentType: true, isPrimary: true, startDate: true, endDate: true, status: true, organization: { select: { id: true, name: true } }, position: { select: { id: true, name: true } }, jobTitle: { select: { id: true, name: true } } } },
        employmentRecords: { orderBy: [{ effectiveAt: 'asc' }, { id: 'asc' }], select: { id: true, status: true, effectiveAt: true, endedAt: true, currentFlag: true } },
      },
    });
    if (!row || row.archivedAt || row.employmentRelationship !== relationship || !this.activeEmployee(row.employee)) return this.notFound(label);
    const today = calendarDay(new Date());
    const businessDate = row.actualExitDate ?? today;
    const assignmentDate = row.actualExitDate ? row.actualExitDate : today;
    const assignment = row.assignments.find((candidate) => this.covers(candidate.startDate, candidate.endDate, assignmentDate));
    if (!assignment || !(await this.canAccessOrganization(user, assignment.organizationId))) return this.notFound(label);
    const canViewCurrentEmployeeDetail = await this.canViewCurrentEmployeeDetail(user, row.employeeId);
    const manager = relationship === EmploymentRelationship.LABOR_WORKER ? await this.findManager(user, row.employeeId, businessDate) : null;
    const base = {
      id: row.id, employeeId: row.employeeId, employeeNo: row.employee.employeeNo, employeeName: row.employee.name ?? '--', workEmail: row.employee.workEmail,
      employmentPeriod: { id: row.id, sequenceNo: row.sequenceNo, employmentRelationship: row.employmentRelationship, entryDate: formatDate(row.entryDate), plannedExitDate: formatDate(row.plannedExitDate), actualExitDate: formatDate(row.actualExitDate), employmentStatus: row.employmentStatus, isRehire: row.isRehire, previousPeriodId: row.previousPeriodId },
      assignment: this.presentPeriodAssignment(assignment), statusHistory: row.employmentRecords.map((record) => ({ ...record, effectiveAt: formatDateTime(record.effectiveAt), endedAt: formatDateTime(record.endedAt) })), canViewCurrentEmployeeDetail,
    };
    return relationship === EmploymentRelationship.INTERN
      ? { ...base, internship: { internshipOrganizationName: null, approvalStatus: null, managerName: null, bankName: null, bankAccountNumber: null, bankBranchName: null }, conversion: null }
      : { ...base, manager, conversion: null, termination: null };
  }

  private async findLatestPrimaryHistoricalAssignment(
    user: AuthenticatedUser,
    employeeId: string,
    employmentPeriodId: string | null,
  ) {
    const accessible = await this.access.getAccessibleOrganizationIds(user);
    const organizationScope = this.access.hasAllEmployeeData(user)
      ? {}
      : { organizationId: { in: accessible ?? [] } };
    return this.prisma.employeeAssignment.findFirst({
      where: {
        employeeId,
        ...(employmentPeriodId ? { employmentPeriodId } : {}),
        isPrimary: true,
        status: { in: ACTIVE_ASSIGNMENT_STATUSES },
        ...organizationScope,
      },
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      select: { id: true },
    });
  }

  private async findHistoricalAssignment(user: AuthenticatedUser, employeeId: string, employmentPeriodId: string | null, date: Date) {
    const accessible = await this.access.getAccessibleOrganizationIds(user);
    const organizationScope = this.access.hasAllEmployeeData(user)
      ? {}
      : { organizationId: { in: accessible ?? [] } };
    const row = await this.prisma.employeeAssignment.findFirst({
      where: {
        employeeId,
        ...(employmentPeriodId ? { employmentPeriodId } : {}),
        status: { in: ACTIVE_ASSIGNMENT_STATUSES },
        isPrimary: true,
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
        ...organizationScope,
      },
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      select: this.assignmentSelect(),
    });
    return row;
  }

  private async hasHistoricalAssignment(user: AuthenticatedUser, employeeId: string, employmentPeriodId: string | null, date: Date, organizationIds: Array<string | null>) {
    const accessible = await this.access.getAccessibleOrganizationIds(user);
    if (this.access.hasAllEmployeeData(user)) return true;
    const ids = organizationIds.filter((value): value is string => Boolean(value));
    return Boolean(await this.prisma.employeeAssignment.findFirst({
      where: { employeeId, ...(employmentPeriodId ? { employmentPeriodId } : {}), archivedAt: null, status: { in: ACTIVE_ASSIGNMENT_STATUSES }, startDate: { lte: date }, OR: [{ endDate: null }, { endDate: { gte: date } }], ...(ids.length ? { organizationId: { in: ids.filter((id) => accessible?.includes(id)) } } : { organizationId: { in: accessible ?? [] } }) },
      select: { id: true },
    }));
  }

  private async findManager(user: AuthenticatedUser, employeeId: string, date: Date) {
    const relationship = await this.prisma.reportingRelationship.findFirst({
      where: { employeeId, relationshipType: 'ADMINISTRATIVE', isPrimary: true, status: RecordStatus.ACTIVE, archivedAt: null, startDate: { lte: date }, OR: [{ endDate: null }, { endDate: { gte: date } }], manager: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }], select: { managerEmployeeId: true, relationshipType: true, isPrimary: true, startDate: true, endDate: true, manager: { select: { name: true } } },
    });
    if (!relationship || !(await this.canViewCurrentEmployeeDetail(user, relationship.managerEmployeeId))) return null;
    return { employeeId: relationship.managerEmployeeId, name: relationship.manager.name ?? '--', relationshipType: relationship.relationshipType, isPrimary: relationship.isPrimary, startDate: formatDate(relationship.startDate), endDate: formatDate(relationship.endDate) };
  }

  private async findApproval(businessId: string, businessType: string) {
    return this.prisma.approvalRequest.findFirst({
      where: { businessId, businessType, archivedAt: null }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, status: true, currentStep: true, submittedAt: true, completedAt: true, steps: { where: { decision: ApprovalDecision.PENDING }, orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }], select: { stepOrder: true, approverUserId: true, approver: { select: { displayName: true } } } } },
    });
  }

  private presentApproval(approval: any) {
    return { id: approval.id, status: approval.status, currentStep: ACTIVE_APPROVAL_STATUSES.includes(approval.status) ? approval.currentStep : null, steps: approval.steps.map((step: any) => ({ stepOrder: step.stepOrder, decision: step.decision, approverName: step.approver.displayName, operatedAt: formatDateTime(step.operatedAt), comment: step.comment })) };
  }

  private assignmentSelect() {
    return {
      id: true, organizationId: true, positionId: true, jobTitleId: true, jobLevel: true, workplaceName: true, workArrangement: true, assignmentType: true, isPrimary: true, startDate: true, endDate: true, status: true,
      organization: { select: { id: true, name: true } }, position: { select: { id: true, name: true } }, jobTitle: { select: { id: true, name: true } },
    } as const;
  }

  private presentAssignment(assignment: any) {
    return { organizationId: assignment.organizationId, departmentName: assignment.organization.name, positionName: assignment.position?.name ?? null, jobTitleName: assignment.jobTitle?.name ?? null, jobLevel: assignment.jobLevel, workplaceName: assignment.workplaceName, startDate: formatDate(assignment.startDate), endDate: formatDate(assignment.endDate), isPrimary: assignment.isPrimary };
  }

  private presentPeriodAssignment(assignment: any) {
    return { id: assignment.id, organizationId: assignment.organizationId, organizationName: assignment.organization.name, positionId: assignment.position?.id ?? assignment.positionId, positionName: assignment.position?.name ?? null, jobTitleId: assignment.jobTitle?.id ?? assignment.jobTitleId, jobTitleName: assignment.jobTitle?.name ?? null, jobLevel: assignment.jobLevel, workplaceName: assignment.workplaceName, workArrangement: assignment.workArrangement, assignmentType: assignment.assignmentType, isPrimary: assignment.isPrimary, startDate: formatDate(assignment.startDate), endDate: formatDate(assignment.endDate), status: assignment.status };
  }

  private async canAccessOrganization(user: AuthenticatedUser, organizationId: string | null) {
    if (!organizationId) return false;
    return this.access.hasAllEmployeeData(user) || Boolean((await this.access.getAccessibleOrganizationIds(user))?.includes(organizationId));
  }

  private async assertHistoricalOrganizationAccess(user: AuthenticatedUser, organizationId: string, date: Date | null) {
    if (!date || !(await this.canAccessOrganization(user, organizationId))) return this.notFound('任职记录');
  }

  private async canViewCurrentEmployeeDetail(user: AuthenticatedUser, employeeId: string) {
    if (this.access.hasAllEmployeeData(user)) return true;
    const where = await this.access.getEmployeeWhere(user, undefined, new Date());
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, ...where }, select: { id: true } });
    return Boolean(employee);
  }

  private activeEmployee(employee: { archivedAt: Date | null; recordStatus: RecordStatus }) {
    return employee.archivedAt === null && employee.recordStatus === RecordStatus.ACTIVE;
  }

  private covers(startDate: Date | null, endDate: Date | null, date: Date) {
    return Boolean(startDate && startDate <= date && (!endDate || endDate >= date));
  }

  private probationEvaluationName(value: string | null) {
    if (value === 'IN_PROBATION') return '试用中考核';
    if (value === 'REGULARIZATION') return '转正考核';
    return null;
  }

  private assertReadPermission(user: AuthenticatedUser) {
    if (!this.access.hasPermission(user, 'employee.read')) throw new ForbiddenException('没有执行此操作的权限');
  }

  private assertId(id: string) {
    if (typeof id !== 'string' || id.trim().length === 0 || id.length > 191) throw new NotFoundException('详情记录不存在或不在当前数据范围内');
  }

  private notFound(label: string): never {
    throw new NotFoundException(`${label}不存在或不在当前数据范围内`);
  }
}
