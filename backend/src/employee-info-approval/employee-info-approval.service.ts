import { Injectable } from '@nestjs/common';
import { ApprovalDecision, AssignmentStatus, Prisma, ProcessStatus, RecordStatus } from '@prisma/client';
import type { EmployeeInfoApprovalListItem, Paginated } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService } from '../demo/demo-data.service';
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
        const canUseLegacyDepartment = row.employee.assignments.length === 0
          && (hasAllEmployeeData || accessibleOrganizationIds.includes(row.employee.organizationId));

        return {
          id: row.id,
          employeeId: row.employeeId,
          canViewEmployeeDetail: true,
          employeeName: row.employee.name,
          departmentName: row.employee.assignments[0]?.organization.name
            ?? (canUseLegacyDepartment ? row.employee.organization.name : null),
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
