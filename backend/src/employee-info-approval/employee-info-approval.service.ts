import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ApprovalDecision, AssignmentStatus, AuditAction, Prisma, ProcessStatus } from '@prisma/client';
import type { EmployeeInfoApprovalReminderResult, EmployeeInfoApprovalListItem, Paginated } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService } from '../audit/audit.service';
import type { AuditContext } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService } from '../demo/demo-data.service';
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
                    feishuOpenId: true,
                    employee: { select: { workEmail: true, mobile: true } },
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

    let openId = currentStep.approver.feishuOpenId;
    if (!openId && currentStep.approver.employee) {
      openId = await this.feishu.resolveOpenIdByContact(currentStep.approver.employee);
      if (openId) {
        const boundUser = await this.prisma.user.findFirst({
          where: { feishuOpenId: openId },
          select: { id: true },
        });
        if (boundUser && boundUser.id !== currentStep.approver.id) {
          throw new ConflictException('飞书账号已绑定其他系统账号，无法发送提醒');
        }
        await this.prisma.user.update({
          where: { id: currentStep.approver.id },
          data: { feishuOpenId: openId, feishuOpenIdSyncedAt: new Date() },
        });
      }
    }
    if (!openId) {
      throw new UnprocessableEntityException('当前审批人未绑定飞书账号，且无法通过工作邮箱或手机号匹配');
    }

    const sent = await this.feishu.sendTextToOpenId(
      openId,
      `【员工信息审批提醒】${approvalRequest.title}\n请及时登录人员管理系统处理。`,
    );
    if (!sent) throw new ServiceUnavailableException('飞书消息发送失败，请检查飞书配置和权限');

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
