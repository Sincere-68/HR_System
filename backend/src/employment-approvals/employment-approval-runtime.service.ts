import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ApprovalDecision,
  ApprovalFlowDefinitionStatus,
  ApprovalFlowNodeAssigneeKind,
  ApprovalFlowVersionStatus,
  AssignmentStatus,
  AuditAction,
  EmploymentApplicationStatus,
  EmploymentConversionType,
  PartTimeRecordStatus,
  Prisma,
  ProcessStatus,
  RecordStatus,
} from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateEmploymentApprovalRequestInput {
  businessType: string;
  businessId: string;
  applicantUserId: string;
  title: string;
  flowVersionId?: string;
}

const PART_TIME_RECORD_BUSINESS_TYPE = 'PART_TIME_RECORD';
const EMPLOYMENT_CONVERSION_BUSINESS_TYPES = new Set<string>([
  EmploymentConversionType.INTERN_TO_EMPLOYEE,
  EmploymentConversionType.LABOR_TO_EMPLOYEE,
]);

type RuntimeClient = Prisma.TransactionClient;
type RuntimeRequest = Prisma.ApprovalRequestGetPayload<{
  include: { steps: { orderBy: { stepOrder: 'asc' } } };
}>;
type RuntimeFlowVersion = Prisma.ApprovalFlowVersionGetPayload<{
  include: {
    definition: true;
    nodes: { orderBy: { stepOrder: 'asc' } };
  };
}>;

@Injectable()
export class EmploymentApprovalRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessControlService,
  ) {}

  async createRequest(input: CreateEmploymentApprovalRequestInput) {
    return this.prisma.$transaction((tx) => this.createRequestInTransaction(tx, input));
  }

  async createRequestInTransaction(
    tx: RuntimeClient,
    input: CreateEmploymentApprovalRequestInput,
  ) {
    const normalized = this.normalizeCreateInput(input);
    await this.assertActiveUser(tx, normalized.applicantUserId, '申请人账号');
      const flowVersion = await this.resolveFlowVersion(tx, normalized);
      const nodes = [...flowVersion.nodes].sort((left, right) => left.stepOrder - right.stepOrder);
      this.assertSequentialNodes(nodes);

      const resolvedSteps = [] as Array<{ stepOrder: number; approverUserId: string }>;
      for (const node of nodes) {
        resolvedSteps.push({
          stepOrder: node.stepOrder,
          approverUserId: await this.resolveApprover(tx, node),
        });
      }

      const now = new Date();
      const request = await tx.approvalRequest.create({
        data: {
          businessType: normalized.businessType,
          businessId: normalized.businessId,
          applicantUserId: normalized.applicantUserId,
          flowVersionId: flowVersion.id,
          title: normalized.title,
          currentStep: resolvedSteps[0]!.stepOrder,
          status: ProcessStatus.PENDING,
          employmentStatus: EmploymentApplicationStatus.PENDING,
          submittedAt: now,
          steps: {
            create: resolvedSteps.map((step) => ({
              ...step,
              decision: ApprovalDecision.PENDING,
            })),
          },
        },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      await this.writeAudit(
        tx,
        normalized.applicantUserId,
        request,
        AuditAction.CREATE,
        'create-request',
        null,
        EmploymentApplicationStatus.PENDING,
      );
    return request;
  }

  async findMine(user: AuthenticatedUser, query: { page: number; pageSize: number }) {
    return this.findPage({
      applicantUserId: user.id,
      archivedAt: null,
      flowVersionId: { not: null },
      employmentStatus: { not: null },
    }, query);
  }

  async findCurrent(user: AuthenticatedUser, query: { page: number; pageSize: number }) {
    const where: Prisma.ApprovalRequestWhereInput = {
      status: ProcessStatus.PENDING,
      employmentStatus: EmploymentApplicationStatus.PENDING,
      archivedAt: null,
      flowVersionId: { not: null },
      steps: {
        some: {
          approverUserId: user.id,
          decision: ApprovalDecision.PENDING,
        },
      },
    };
    const offset = (query.page - 1) * query.pageSize;
    const candidates = await this.prisma.approvalRequest.findMany({
      where,
      include: {
        applicant: { select: { id: true, displayName: true } },
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: { approver: { select: { id: true, displayName: true } } },
        },
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
    });
    const current = candidates.filter((request) => request.steps.some((step) => (
      step.stepOrder === request.currentStep
      && step.approverUserId === user.id
      && step.decision === ApprovalDecision.PENDING
    )));
    return {
      data: current.slice(offset, offset + query.pageSize),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: current.length,
        totalPages: Math.ceil(current.length / query.pageSize),
      },
    };
  }

  async findDetail(user: AuthenticatedUser, id: string) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, displayName: true } },
        flowVersion: {
          select: {
            id: true,
            versionNumber: true,
            definition: { select: { id: true, code: true, name: true } },
          },
        },
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: { approver: { select: { id: true, displayName: true } } },
        },
      },
    });
    if (!request || !request.flowVersionId || !request.employmentStatus || request.archivedAt) {
      throw new NotFoundException('任职审批申请不存在');
    }
    const isParticipant = request.applicantUserId === user.id
      || request.steps.some((step) => step.approverUserId === user.id);
    const canReadAsHr = user.permissions.includes(PERMISSIONS.EMPLOYEE_READ)
      && (
        this.access.hasAllEmployeeData(user)
        || await this.canReadBusinessRequestInScope(user, request)
      );
    if (!isParticipant && !canReadAsHr) {
      throw new ForbiddenException('无权查看该审批申请');
    }
    return {
      ...request,
      businessSummary: await this.presentBusinessSummary(request),
    };
  }

  async approveCurrentStep(user: AuthenticatedUser, id: string, comment?: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await this.getPendingRequest(tx, id);
      const currentStep = this.getCurrentPendingStep(request);
      this.assertCurrentApprover(user, currentStep.approverUserId);

      const now = new Date();
      await this.decideStep(
        tx,
        request,
        currentStep.id,
        ApprovalDecision.APPROVED,
        this.normalizeOptionalComment(comment),
        now,
      );

      const nextStep = request.steps.find((step) => (
        step.stepOrder > currentStep.stepOrder && step.decision === ApprovalDecision.PENDING
      ));
      const finalApproval = !nextStep;
      const nextEmploymentStatus = finalApproval
        ? EmploymentApplicationStatus.PENDING_EFFECTIVE
        : EmploymentApplicationStatus.PENDING;
      if (finalApproval) {
        await this.syncBusinessStatus(tx, request, EmploymentApplicationStatus.PENDING_EFFECTIVE);
      }
      const updated = await tx.approvalRequest.updateMany({
        where: {
          id: request.id,
          currentStep: request.currentStep,
          status: ProcessStatus.PENDING,
          employmentStatus: EmploymentApplicationStatus.PENDING,
          archivedAt: null,
        },
        data: finalApproval
          ? {
              status: ProcessStatus.APPROVED,
              employmentStatus: EmploymentApplicationStatus.PENDING_EFFECTIVE,
              completedAt: now,
            }
          : { currentStep: nextStep.stepOrder },
      });
      if (updated.count !== 1) this.concurrentChange();

      await this.writeAudit(
        tx,
        user.id,
        request,
        AuditAction.UPDATE,
        'approve-current-step',
        EmploymentApplicationStatus.PENDING,
        nextEmploymentStatus,
        { stepOrder: currentStep.stepOrder, finalApproval },
      );
      return {
        id: request.id,
        currentStep: nextStep?.stepOrder ?? request.currentStep,
        status: finalApproval ? ProcessStatus.APPROVED : ProcessStatus.PENDING,
        employmentStatus: nextEmploymentStatus,
      };
    });
  }

  /**
   * Phase 1 has no revision iteration on ApprovalStep. A return therefore
   * closes this request, preserves every prior decision, skips only the
   * current step, and requires the business module to resubmit as a new
   * request after revision.
   */
  async returnForRevision(user: AuthenticatedUser, id: string, comment: string) {
    const normalizedComment = this.normalizeRequiredComment(comment);
    return this.prisma.$transaction(async (tx) => {
      const request = await this.getPendingRequest(tx, id);
      const currentStep = this.getCurrentPendingStep(request);
      this.assertCurrentApprover(user, currentStep.approverUserId);
      const now = new Date();

      await this.decideStep(
        tx,
        request,
        currentStep.id,
        ApprovalDecision.SKIPPED,
        normalizedComment,
        now,
      );
      await this.syncBusinessStatus(tx, request, EmploymentApplicationStatus.DRAFT);
      await this.closePendingRequest(
        tx,
        request,
        ProcessStatus.WITHDRAWN,
        EmploymentApplicationStatus.DRAFT,
        now,
      );
      await this.writeAudit(
        tx,
        user.id,
        request,
        AuditAction.UPDATE,
        'return-for-revision',
        EmploymentApplicationStatus.PENDING,
        EmploymentApplicationStatus.DRAFT,
        { stepOrder: currentStep.stepOrder, comment: normalizedComment },
      );
      return {
        id: request.id,
        status: ProcessStatus.WITHDRAWN,
        employmentStatus: EmploymentApplicationStatus.DRAFT,
      };
    });
  }

  async reject(user: AuthenticatedUser, id: string, comment: string) {
    const normalizedComment = this.normalizeRequiredComment(comment);
    return this.prisma.$transaction(async (tx) => {
      const request = await this.getPendingRequest(tx, id);
      const currentStep = this.getCurrentPendingStep(request);
      this.assertCurrentApprover(user, currentStep.approverUserId);
      const now = new Date();

      await this.decideStep(
        tx,
        request,
        currentStep.id,
        ApprovalDecision.REJECTED,
        normalizedComment,
        now,
      );
      await this.syncBusinessStatus(tx, request, EmploymentApplicationStatus.REJECTED);
      await this.closePendingRequest(
        tx,
        request,
        ProcessStatus.REJECTED,
        EmploymentApplicationStatus.REJECTED,
        now,
      );
      await this.writeAudit(
        tx,
        user.id,
        request,
        AuditAction.UPDATE,
        'reject',
        EmploymentApplicationStatus.PENDING,
        EmploymentApplicationStatus.REJECTED,
        { stepOrder: currentStep.stepOrder, comment: normalizedComment },
      );
      return {
        id: request.id,
        status: ProcessStatus.REJECTED,
        employmentStatus: EmploymentApplicationStatus.REJECTED,
      };
    });
  }

  async withdraw(user: AuthenticatedUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await this.getPendingRequest(tx, id);
      if (request.applicantUserId !== user.id) {
        throw new ForbiddenException('仅申请人可以撤回审批申请');
      }
      if (request.steps.some((step) => step.decision !== ApprovalDecision.PENDING)) {
        throw new ConflictException('已有审批节点作出决定，申请不能撤回');
      }

      const now = new Date();
      await this.syncBusinessStatus(tx, request, EmploymentApplicationStatus.WITHDRAWN);
      await this.closePendingRequest(
        tx,
        request,
        ProcessStatus.WITHDRAWN,
        EmploymentApplicationStatus.WITHDRAWN,
        now,
      );
      await this.writeAudit(
        tx,
        user.id,
        request,
        AuditAction.UPDATE,
        'withdraw',
        EmploymentApplicationStatus.PENDING,
        EmploymentApplicationStatus.WITHDRAWN,
      );
      return {
        id: request.id,
        status: ProcessStatus.WITHDRAWN,
        employmentStatus: EmploymentApplicationStatus.WITHDRAWN,
      };
    });
  }

  async markPendingEffective(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await this.getFoundationRequest(tx, id);
      this.assertFinalApproval(request);

      if (request.employmentStatus === EmploymentApplicationStatus.PENDING_EFFECTIVE) {
        return {
          id: request.id,
          status: ProcessStatus.APPROVED,
          employmentStatus: EmploymentApplicationStatus.PENDING_EFFECTIVE,
        };
      }
      if (request.employmentStatus !== EmploymentApplicationStatus.APPROVED) {
        throw new ConflictException('申请尚未处于最终审批通过状态');
      }

      const updated = await tx.approvalRequest.updateMany({
        where: {
          id: request.id,
          status: ProcessStatus.APPROVED,
          employmentStatus: EmploymentApplicationStatus.APPROVED,
          archivedAt: null,
        },
        data: { employmentStatus: EmploymentApplicationStatus.PENDING_EFFECTIVE },
      });
      if (updated.count !== 1) this.concurrentChange();
      await this.writeAudit(
        tx,
        request.applicantUserId,
        request,
        AuditAction.UPDATE,
        'mark-pending-effective',
        EmploymentApplicationStatus.APPROVED,
        EmploymentApplicationStatus.PENDING_EFFECTIVE,
        { actorType: 'SYSTEM_RUNTIME' },
      );
      return {
        id: request.id,
        status: ProcessStatus.APPROVED,
        employmentStatus: EmploymentApplicationStatus.PENDING_EFFECTIVE,
      };
    });
  }

  async completeEffective(id: string) {
    return this.prisma.$transaction((tx) => this.completeEffectiveInTransaction(tx, id));
  }

  async completeEffectiveInTransaction(tx: RuntimeClient, id: string) {
    const request = await this.getFoundationRequest(tx, id);
      if (
        request.status !== ProcessStatus.APPROVED
        || request.employmentStatus !== EmploymentApplicationStatus.PENDING_EFFECTIVE
      ) {
        throw new ConflictException('仅待生效的最终审批申请可以标记完成');
      }
      this.assertFinalApproval(request);

      const now = new Date();
      const updated = await tx.approvalRequest.updateMany({
        where: {
          id: request.id,
          status: ProcessStatus.APPROVED,
          employmentStatus: EmploymentApplicationStatus.PENDING_EFFECTIVE,
          archivedAt: null,
        },
        data: {
          status: ProcessStatus.COMPLETED,
          employmentStatus: EmploymentApplicationStatus.COMPLETED,
          completedAt: now,
        },
      });
      if (updated.count !== 1) this.concurrentChange();
      await this.writeAudit(
        tx,
        request.applicantUserId,
        request,
        AuditAction.UPDATE,
        'complete-effective',
        EmploymentApplicationStatus.PENDING_EFFECTIVE,
        EmploymentApplicationStatus.COMPLETED,
        { actorType: 'SYSTEM_RUNTIME' },
      );
    return {
      id: request.id,
      status: ProcessStatus.COMPLETED,
      employmentStatus: EmploymentApplicationStatus.COMPLETED,
    };
  }

  private async presentBusinessSummary(
    request: Pick<RuntimeRequest, 'businessType' | 'businessId'>,
  ) {
    if (!request.businessId) return null;
    if (EMPLOYMENT_CONVERSION_BUSINESS_TYPES.has(request.businessType)) {
      const conversion = await this.prisma.employmentConversion.findUnique({
        where: { id: request.businessId },
        select: {
          id: true,
          status: true,
          plannedEffectiveDate: true,
          targetOrganization: { select: { name: true } },
          sourceSnapshot: true,
          employee: { select: { id: true, employeeNo: true, name: true } },
        },
      });
      if (!conversion) return null;
      return {
        kind: 'CONVERSION' as const,
        conversionId: conversion.id,
        employee: conversion.employee,
        sourceOrganizationName: this.readSnapshotOrganizationName(conversion.sourceSnapshot),
        targetOrganizationName: conversion.targetOrganization.name,
        plannedEffectiveDate: conversion.plannedEffectiveDate.toISOString().slice(0, 10),
        status: conversion.status,
      };
    }
    if (request.businessType === PART_TIME_RECORD_BUSINESS_TYPE) {
      const record = await this.prisma.partTimeRecord.findUnique({
        where: { id: request.businessId },
        select: {
          id: true,
          type: true,
          institution: true,
          startDate: true,
          endDate: true,
          status: true,
          organization: { select: { name: true } },
          employee: { select: { id: true, employeeNo: true, name: true } },
        },
      });
      if (!record) return null;
      return {
        kind: 'PART_TIME' as const,
        partTimeRecordId: record.id,
        employee: record.employee,
        organizationName: record.organization.name,
        type: record.type,
        institution: record.institution,
        startDate: record.startDate.toISOString().slice(0, 10),
        endDate: record.endDate?.toISOString().slice(0, 10) ?? null,
        status: record.status,
      };
    }
    return null;
  }

  private readSnapshotOrganizationName(snapshot: Prisma.JsonValue) {
    if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object') return null;
    const assignment = snapshot.assignment;
    if (!assignment || Array.isArray(assignment) || typeof assignment !== 'object') return null;
    const organization = assignment.organization;
    if (!organization || Array.isArray(organization) || typeof organization !== 'object') return null;
    return typeof organization.name === 'string' ? organization.name : null;
  }

  private async canReadBusinessRequestInScope(
    user: AuthenticatedUser,
    request: Pick<RuntimeRequest, 'businessType' | 'businessId'>,
  ) {
    if (!request.businessId) return false;
    const accessibleOrganizationIds = await this.access.getAccessibleOrganizationIds(user) ?? [];
    if (accessibleOrganizationIds.length === 0) return false;

    if (EMPLOYMENT_CONVERSION_BUSINESS_TYPES.has(request.businessType)) {
      const conversion = await this.prisma.employmentConversion.findFirst({
        where: { id: request.businessId, archivedAt: null },
        select: { id: true, targetOrganizationId: true, sourceSnapshot: true },
      });
      const sourceOrganizationId = this.readConversionSourceOrganizationId(conversion?.sourceSnapshot);
      return Boolean(
        conversion
        && sourceOrganizationId
        && accessibleOrganizationIds.includes(sourceOrganizationId)
        && accessibleOrganizationIds.includes(conversion.targetOrganizationId)
      );
    }

    if (request.businessType === PART_TIME_RECORD_BUSINESS_TYPE) {
      return Boolean(await this.prisma.partTimeRecord.findFirst({
        where: {
          id: request.businessId,
          organizationId: { in: accessibleOrganizationIds },
          employee: {
            is: {
              recordStatus: RecordStatus.ACTIVE,
              archivedAt: null,
              ...await this.access.getEmployeeWhere(user, accessibleOrganizationIds),
            },
          },
          archivedAt: null,
        },
        select: { id: true },
      }));
    }

    return false;
  }

  private readConversionSourceOrganizationId(snapshot: Prisma.JsonValue | undefined) {
    if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object') return null;
    const assignment = snapshot.assignment;
    if (!assignment || Array.isArray(assignment) || typeof assignment !== 'object') return null;
    return typeof assignment.organizationId === 'string' ? assignment.organizationId : null;
  }

  private async findPage(
    where: Prisma.ApprovalRequestWhereInput,
    query: { page: number; pageSize: number },
  ) {
    const skip = (query.page - 1) * query.pageSize;
    const [candidateRows, total] = await this.prisma.$transaction([
      this.prisma.approvalRequest.findMany({
        where,
        include: {
          applicant: { select: { id: true, displayName: true } },
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: { approver: { select: { id: true, displayName: true } } },
          },
        },
        orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);
    return {
      data: candidateRows,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  private normalizeCreateInput(input: CreateEmploymentApprovalRequestInput) {
    const normalized = {
      businessType: input.businessType?.trim(),
      businessId: input.businessId?.trim(),
      applicantUserId: input.applicantUserId?.trim(),
      title: input.title?.trim(),
      flowVersionId: input.flowVersionId?.trim() || undefined,
    };
    if (!normalized.businessType || !normalized.businessId || !normalized.applicantUserId || !normalized.title) {
      throw new BadRequestException('业务类型、业务 ID、申请人和标题不能为空');
    }
    if (
      normalized.businessType.length > 100
      || normalized.businessId.length > 191
      || normalized.applicantUserId.length > 191
      || normalized.title.length > 191
      || (normalized.flowVersionId?.length ?? 0) > 191
    ) {
      throw new BadRequestException('审批申请字段长度超过限制');
    }
    return normalized;
  }

  private async resolveFlowVersion(
    tx: RuntimeClient,
    input: ReturnType<EmploymentApprovalRuntimeService['normalizeCreateInput']>,
  ): Promise<RuntimeFlowVersion> {
    if (input.flowVersionId) {
      const version = await tx.approvalFlowVersion.findFirst({
        where: {
          id: input.flowVersionId,
          status: ApprovalFlowVersionStatus.PUBLISHED,
          definition: {
            is: {
              businessType: input.businessType,
              status: ApprovalFlowDefinitionStatus.PUBLISHED,
              archivedAt: null,
            },
          },
        },
        include: {
          definition: true,
          nodes: { orderBy: { stepOrder: 'asc' } },
        },
      });
      if (!version) throw new UnprocessableEntityException('指定的已发布审批流程版本不可用');
      return version;
    }

    const definitions = await tx.approvalFlowDefinition.findMany({
      where: {
        businessType: input.businessType,
        status: ApprovalFlowDefinitionStatus.PUBLISHED,
        archivedAt: null,
      },
      include: {
        versions: {
          where: { status: ApprovalFlowVersionStatus.PUBLISHED },
          include: {
            definition: true,
            nodes: { orderBy: { stepOrder: 'asc' } },
          },
          orderBy: [{ versionNumber: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: { id: 'asc' },
    });
    if (definitions.length === 0) {
      throw new UnprocessableEntityException('该业务类型没有已发布的审批流程');
    }
    if (definitions.length !== 1) {
      throw new ConflictException('该业务类型存在多个已发布的审批流程定义');
    }
    const versions = definitions[0]!.versions;
    if (versions.length === 0) {
      throw new UnprocessableEntityException('审批流程定义没有已发布版本');
    }
    if (versions.length !== 1) {
      throw new ConflictException('审批流程定义存在多个已发布版本');
    }
    return versions[0]!;
  }

  private assertSequentialNodes(nodes: RuntimeFlowVersion['nodes']) {
    if (nodes.length === 0) throw new UnprocessableEntityException('审批流程版本没有审批节点');
    nodes.forEach((node, index) => {
      if (node.stepOrder !== index + 1) {
        throw new UnprocessableEntityException('审批流程节点必须从 1 开始连续排序');
      }
    });
  }

  private async resolveApprover(
    tx: RuntimeClient,
    node: RuntimeFlowVersion['nodes'][number],
  ) {
    if (node.assigneeKind === ApprovalFlowNodeAssigneeKind.USER) {
      if (!node.assigneeUserId) throw new UnprocessableEntityException('用户审批节点缺少审批人');
      return (await this.assertActiveUser(tx, node.assigneeUserId, `第 ${node.stepOrder} 级审批人`)).id;
    }

    if (node.assigneeKind === ApprovalFlowNodeAssigneeKind.ROLE) {
      if (!node.assigneeRoleId) throw new UnprocessableEntityException('角色审批节点缺少角色');
      const user = await tx.user.findFirst({
        where: {
          roleId: node.assigneeRoleId,
          status: RecordStatus.ACTIVE,
          archivedAt: null,
        },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      if (!user) throw new UnprocessableEntityException(`第 ${node.stepOrder} 级角色没有有效审批账号`);
      return user.id;
    }

    if (node.assigneeKind === ApprovalFlowNodeAssigneeKind.DIRECTORY) {
      const rule = this.parseJobTitleRule(node.assigneeRule, node.stepOrder);
      const businessDate = this.shanghaiBusinessDate();
      const users = await tx.user.findMany({
        where: {
          status: RecordStatus.ACTIVE,
          archivedAt: null,
          employee: {
            is: {
              recordStatus: RecordStatus.ACTIVE,
              archivedAt: null,
              assignments: {
                some: {
                  jobTitleId: rule.value,
                  status: AssignmentStatus.ACTIVE,
                  archivedAt: null,
                  startDate: { lte: businessDate },
                  OR: [{ endDate: null }, { endDate: { gte: businessDate } }],
                },
              },
            },
          },
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 2,
      });
      if (users.length === 0) {
        throw new UnprocessableEntityException(`第 ${node.stepOrder} 级职务目录没有有效审批账号`);
      }
      if (users.length !== 1) {
        throw new ConflictException(`第 ${node.stepOrder} 级职务目录匹配多个审批账号`);
      }
      return users[0]!.id;
    }

    throw new UnprocessableEntityException(`第 ${node.stepOrder} 级审批节点类型无效`);
  }

  private shanghaiBusinessDate(value = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private parseJobTitleRule(rule: Prisma.JsonValue, stepOrder: number) {
    if (
      !rule
      || Array.isArray(rule)
      || typeof rule !== 'object'
      || rule.directory !== 'JOB_TITLE'
      || typeof rule.value !== 'string'
      || !rule.value.trim()
    ) {
      throw new UnprocessableEntityException(`第 ${stepOrder} 级目录审批规则无效`);
    }
    return { directory: 'JOB_TITLE' as const, value: rule.value.trim() };
  }

  private async assertActiveUser(tx: RuntimeClient, id: string, label: string) {
    const user = await tx.user.findFirst({
      where: { id, status: RecordStatus.ACTIVE, archivedAt: null },
      select: { id: true },
    });
    if (!user) throw new UnprocessableEntityException(`${label}不存在或已停用`);
    return user;
  }

  private async getFoundationRequest(tx: RuntimeClient, id: string): Promise<RuntimeRequest> {
    const request = await tx.approvalRequest.findFirst({
      where: {
        id,
        archivedAt: null,
        flowVersionId: { not: null },
        employmentStatus: { not: null },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!request) throw new NotFoundException('任职审批申请不存在');
    return request;
  }

  private async getPendingRequest(tx: RuntimeClient, id: string) {
    const request = await this.getFoundationRequest(tx, id);
    if (
      request.status !== ProcessStatus.PENDING
      || request.employmentStatus !== EmploymentApplicationStatus.PENDING
    ) {
      throw new ConflictException('审批申请不在待审批状态');
    }
    return request;
  }

  private getCurrentPendingStep(request: RuntimeRequest) {
    const step = request.steps.find((candidate) => candidate.stepOrder === request.currentStep);
    if (!step || step.decision !== ApprovalDecision.PENDING) {
      throw new ConflictException('当前审批节点不存在或已处理');
    }
    return step;
  }

  private assertCurrentApprover(user: AuthenticatedUser, approverUserId: string) {
    if (user.id !== approverUserId) throw new ForbiddenException('仅当前审批人可以处理该审批节点');
  }

  private async decideStep(
    tx: RuntimeClient,
    request: RuntimeRequest,
    stepId: string,
    decision: ApprovalDecision,
    comment: string | null,
    operatedAt: Date,
  ) {
    const updated = await tx.approvalStep.updateMany({
      where: {
        id: stepId,
        approvalRequestId: request.id,
        stepOrder: request.currentStep,
        decision: ApprovalDecision.PENDING,
      },
      data: { decision, comment, operatedAt },
    });
    if (updated.count !== 1) this.concurrentChange();
  }

  private async closePendingRequest(
    tx: RuntimeClient,
    request: RuntimeRequest,
    status: ProcessStatus,
    employmentStatus: EmploymentApplicationStatus,
    completedAt: Date,
  ) {
    const updated = await tx.approvalRequest.updateMany({
      where: {
        id: request.id,
        currentStep: request.currentStep,
        status: ProcessStatus.PENDING,
        employmentStatus: EmploymentApplicationStatus.PENDING,
        archivedAt: null,
      },
      data: { status, employmentStatus, completedAt },
    });
    if (updated.count !== 1) this.concurrentChange();
  }

  private async syncBusinessStatus(
    tx: RuntimeClient,
    request: Pick<RuntimeRequest, 'id' | 'businessType' | 'businessId'>,
    targetStatus: EmploymentApplicationStatus,
  ) {
    if (!request.businessId) return;

    if (EMPLOYMENT_CONVERSION_BUSINESS_TYPES.has(request.businessType)) {
      const updated = await tx.employmentConversion.updateMany({
        where: {
          id: request.businessId,
          approvalRequestId: request.id,
          status: EmploymentApplicationStatus.PENDING,
          archivedAt: null,
        },
        data: { status: targetStatus },
      });
      if (updated.count !== 1) this.concurrentChange();
      return;
    }

    if (request.businessType === PART_TIME_RECORD_BUSINESS_TYPE) {
      const partTimeStatus = this.toPartTimeRecordStatus(targetStatus);
      if (!partTimeStatus) return;
      const updated = await tx.partTimeRecord.updateMany({
        where: {
          id: request.businessId,
          approvalRequestId: request.id,
          status: PartTimeRecordStatus.PENDING,
          archivedAt: null,
        },
        data: { status: partTimeStatus },
      });
      if (updated.count !== 1) this.concurrentChange();
    }
  }

  private toPartTimeRecordStatus(status: EmploymentApplicationStatus) {
    switch (status) {
      case EmploymentApplicationStatus.PENDING_EFFECTIVE:
        return PartTimeRecordStatus.PENDING_EFFECTIVE;
      case EmploymentApplicationStatus.REJECTED:
        return PartTimeRecordStatus.REJECTED;
      case EmploymentApplicationStatus.WITHDRAWN:
        return PartTimeRecordStatus.WITHDRAWN;
      case EmploymentApplicationStatus.DRAFT:
        return PartTimeRecordStatus.DRAFT;
      default:
        return null;
    }
  }

  private assertFinalApproval(request: RuntimeRequest) {
    const finalStep = request.steps.at(-1);
    if (
      request.status !== ProcessStatus.APPROVED
      || !finalStep
      || request.currentStep !== finalStep.stepOrder
      || request.steps.some((step) => step.decision !== ApprovalDecision.APPROVED)
    ) {
      throw new ConflictException('申请尚未完成最终审批');
    }
  }

  private normalizeOptionalComment(comment?: string) {
    if (comment === undefined || comment === null) return null;
    const normalized = comment.trim();
    if (normalized.length > 2_000) throw new BadRequestException('审批意见不能超过 2000 个字符');
    return normalized || null;
  }

  private normalizeRequiredComment(comment: string) {
    const normalized = comment?.trim();
    if (!normalized) throw new BadRequestException('审批意见不能为空');
    if (normalized.length > 2_000) throw new BadRequestException('审批意见不能超过 2000 个字符');
    return normalized;
  }

  private async writeAudit(
    tx: RuntimeClient,
    userId: string,
    request: Pick<RuntimeRequest, 'id' | 'businessType' | 'businessId' | 'flowVersionId'>,
    action: AuditAction,
    runtimeAction: string,
    fromStatus: EmploymentApplicationStatus | null,
    toStatus: EmploymentApplicationStatus,
    extra: Record<string, string | number | boolean | null> = {},
  ) {
    await this.audit.create(
      { userId },
      action,
      request.id,
      {
        resource: 'employment-approval-request',
        action: runtimeAction,
        businessType: request.businessType,
        businessId: request.businessId,
        flowVersionId: request.flowVersionId,
        fromStatus,
        toStatus,
        ...extra,
      },
      tx,
      'employment-approval-request',
    );
  }

  private concurrentChange(): never {
    throw new ConflictException('审批申请已被其他操作更新，请刷新后重试');
  }
}
