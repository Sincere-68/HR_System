import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ApprovalDecision, AssignmentStatus, AuditAction, Prisma, ProcessStatus } from '@prisma/client';
import type { EmployeeInfoApprovalReminderResult, EmployeeInfoApprovalListItem, Paginated } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService } from '../audit/audit.service';
import type { AuditContext } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService } from '../demo/demo-data.service';
import type { FeishuCard } from '../feishu/feishu.service';
import { FeishuService } from '../feishu/feishu.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryEmployeeInfoApprovalDto } from './dto/query-employee-info-approval.dto';

const EMPLOYEE_INFO_BUSINESS_TYPE = 'EMPLOYEE_CHANGE_REQUEST';
const ACTIVE_APPROVAL_STATUSES: ProcessStatus[] = [
  ProcessStatus.PENDING,
  ProcessStatus.IN_PROGRESS,
];

@Injectable()
export class EmployeeInfoApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly demo: DemoDataService,
    private readonly audit: AuditService,
    private readonly feishu: FeishuService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: QueryEmployeeInfoApprovalDto,
  ): Promise<Paginated<EmployeeInfoApprovalListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const now = new Date();
    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const currentAssignmentWhere: Prisma.EmployeeAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    };
    const employeeConditions: Prisma.EmployeeWhereInput[] = [];

    if (!hasAllEmployeeData) {
      employeeConditions.push(await this.access.getEmployeeWhere(user, accessibleOrganizationIds, now));
    }

    if (query.departmentId) {
      if (!hasAllEmployeeData && !accessibleOrganizationIds.includes(query.departmentId)) {
        return this.emptyPage(query);
      }
      const selectedOrganizationIds = hasAllEmployeeData
        ? await this.getOrganizationSubtreeIds(query.departmentId)
        : await this.getOrganizationSubtreeIds(query.departmentId, accessibleOrganizationIds);
      employeeConditions.push({
        OR: [
          {
            assignments: {
              some: {
                ...currentAssignmentWhere,
                organizationId: { in: selectedOrganizationIds },
              },
            },
          },
          {
            assignments: { none: {} },
            organizationId: { in: selectedOrganizationIds },
          },
        ],
      });
    }

    if (query.keyword) {
      employeeConditions.push({
        OR: [
          { name: { contains: query.keyword } },
          { employeeNo: { contains: query.keyword } },
        ],
      });
    }

    const where: Prisma.EmployeeChangeRequestWhereInput = {
      archivedAt: null,
      approvalRequest: {
        is: {
          businessType: EMPLOYEE_INFO_BUSINESS_TYPE,
          archivedAt: null,
        },
      },
      employee: { is: { AND: employeeConditions } },
    };
    const displayedAssignmentWhere: Prisma.EmployeeAssignmentWhereInput = hasAllEmployeeData
      ? currentAssignmentWhere
      : {
          ...currentAssignmentWhere,
          organizationId: { in: accessibleOrganizationIds },
        };
    const include = Prisma.validator<Prisma.EmployeeChangeRequestInclude>()({
      employee: {
        include: {
          organization: { select: { id: true, name: true } },
          assignments: {
            where: displayedAssignmentWhere,
            orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
            include: { organization: { select: { name: true } } },
          },
        },
      },
      approvalRequest: {
        include: {
          applicant: { select: { displayName: true } },
          steps: {
            where: { decision: ApprovalDecision.PENDING },
            orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }],
            include: { approver: { select: { displayName: true } } },
          },
        },
      },
    });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeChangeRequest.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeChangeRequest.count({ where }),
    ]);

    return {
      data: rows.map((row) => {
        const approvalRequest = row.approvalRequest;
        const currentStep = approvalRequest && ACTIVE_APPROVAL_STATUSES.includes(approvalRequest.status)
          ? approvalRequest.steps.find((step) => step.stepOrder === approvalRequest.currentStep)
          : undefined;
        const canUseLegacyDepartment = Boolean(row.employee.organizationId && row.employee.organization)
          && row.employee.assignments.length === 0
          && (hasAllEmployeeData || accessibleOrganizationIds.includes(row.employee.organizationId!));

        return {
          id: row.id,
          employeeId: row.employeeId,
          canViewEmployeeDetail: true,
          employeeName: row.employee.name ?? '--',
          departmentName: row.employee.assignments[0]?.organization.name
            ?? (canUseLegacyDepartment ? row.employee.organization?.name ?? null : null),
          activityName: null,
          applicantName: approvalRequest?.applicant.displayName ?? null,
          submittedAt: approvalRequest?.submittedAt?.toISOString() ?? null,
          status: (approvalRequest?.status ?? row.status) as ProcessStatus,
          currentApproverName: currentStep?.approver.displayName ?? null,
        };
      }),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async sendReminder(
    user: AuthenticatedUser,
    changeRequestId: string,
    auditContext: AuditContext,
  ): Promise<EmployeeInfoApprovalReminderResult> {
    if (this.demo.enabled) throw new ConflictException('演示模式不支持发送飞书审批提醒');
    if (!this.feishu.enabled) throw new ConflictException('飞书提醒未启用');

    const employeeScope = this.access.hasAllEmployeeData(user)
      ? {}
      : await this.access.getEmployeeWhere(user);
    const changeRequest = await this.prisma.employeeChangeRequest.findFirst({
      where: {
        id: changeRequestId,
        archivedAt: null,
        employee: { is: employeeScope },
        approvalRequest: {
          is: {
            businessType: EMPLOYEE_INFO_BUSINESS_TYPE,
            archivedAt: null,
            status: { in: ACTIVE_APPROVAL_STATUSES },
          },
        },
      },
      select: {
        id: true,
        employee: { select: { name: true } },
        changedFields: true,
        approvalRequest: {
          select: {
            id: true,
            title: true,
            currentStep: true,
            steps: {
              where: { decision: ApprovalDecision.PENDING },
              select: {
                id: true,
                stepOrder: true,
                approver: {
                  select: {
                    id: true,
                    displayName: true,
                    employee: { select: { workEmail: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const approvalRequest = changeRequest?.approvalRequest;
    if (!changeRequest || !approvalRequest) {
      throw new NotFoundException('待处理审批记录不存在或无权访问');
    }

    const currentStep = approvalRequest.steps.find((step) => step.stepOrder === approvalRequest.currentStep);
    if (!currentStep) throw new ConflictException('当前审批步骤不存在或已处理，无法发送提醒');

    const workEmail = currentStep.approver.employee?.workEmail?.trim();
    if (!workEmail) {
      throw new UnprocessableEntityException('当前审批人未配置企业邮箱，无法发送飞书提醒');
    }

    const openId = await this.feishu.resolveOpenIdByContact({ workEmail });
    if (!openId) throw new ServiceUnavailableException('审批人企业邮箱无法匹配唯一飞书身份，请检查企业邮箱和飞书通讯录权限');
    const sent = await this.feishu.sendCardToOpenId(openId, this.approvalCard({
      title: approvalRequest.title,
      employeeName: changeRequest.employee.name ?? '未命名员工',
      changedFields: changeRequest.changedFields,
      approvalStepId: currentStep.id,
    }));
    if (!sent) throw new ServiceUnavailableException('飞书审批卡片发送失败，请检查飞书配置和权限');

    const sentAt = new Date();
    await this.audit.create(
      auditContext,
      AuditAction.UPDATE,
      changeRequest.id,
      {
        resource: 'employee-info-approval',
        action: 'send-feishu-reminder',
        approvalRequestId: approvalRequest.id,
        approvalStepId: currentStep.id,
      },
      undefined,
      'employee_info_approval',
    );
    return {
      status: 'SENT',
      approverName: currentStep.approver.displayName,
      sentAt: sentAt.toISOString(),
    };
  }

  private approvalCard(input: { title: string; employeeName: string; changedFields: unknown; approvalStepId: string }): FeishuCard {
    const detailUrl = `${process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5173'}/personnel/approval`;
    return {
      schema: '2.0',
      config: { enable_forward: false },
      header: { title: { tag: 'plain_text', content: '员工信息审批' }, template: 'blue' },
      body: {
        elements: [
          { tag: 'markdown', content: `**审批事项**：${input.title}\n**员工**：${input.employeeName}\n**事项摘要**：${this.changedFieldSummary(input.changedFields)}` },
          { tag: 'form', name: 'employee_info_approval_action', elements: [
            { tag: 'input', name: 'comment', input_type: 'multiline_text', placeholder: { tag: 'plain_text', content: '审批意见（可选；驳回时按既有流程规则处理）' } },
            { tag: 'button', name: 'submit_approve', text: { tag: 'plain_text', content: '通过' }, type: 'primary', form_action_type: 'submit', value: { kind: 'employee-info-approval', approvalStepId: input.approvalStepId, action: 'APPROVE' } },
            { tag: 'button', name: 'submit_reject', text: { tag: 'plain_text', content: '驳回' }, type: 'danger', form_action_type: 'submit', value: { kind: 'employee-info-approval', approvalStepId: input.approvalStepId, action: 'REJECT' } },
            { tag: 'button', text: { tag: 'plain_text', content: '查看 HR 系统详情' }, type: 'default', multi_url: { url: detailUrl } },
          ] },
        ],
      },
    };
  }

  private changedFieldSummary(value: unknown) {
    if (!Array.isArray(value)) return '员工信息变更';
    const fields = value.filter((field): field is string => typeof field === 'string' && Boolean(field.trim())).slice(0, 8);
    return fields.length > 0 ? fields.join('、') : '员工信息变更';
  }

  private async getOrganizationSubtreeIds(rootId: string, allowedIds?: string[]) {
    const organizations = await this.prisma.organization.findMany({
      select: { id: true, parentId: true },
    });
    const allowed = allowedIds ? new Set(allowedIds) : null;
    const subtree = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const organization of organizations) {
        if (
          organization.parentId
          && subtree.has(organization.parentId)
          && (!allowed || allowed.has(organization.id))
          && !subtree.has(organization.id)
        ) {
          subtree.add(organization.id);
          changed = true;
        }
      }
    }
    return [...subtree];
  }

  private emptyPage(query: QueryEmployeeInfoApprovalDto): Paginated<EmployeeInfoApprovalListItem> {
    return {
      data: [],
      meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 },
    };
  }
}
