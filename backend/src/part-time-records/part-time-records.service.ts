import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  EmploymentApplicationStatus,
  PartTimeRecordStatus,
  Prisma,
  ProcessStatus,
  RecordStatus,
} from '@prisma/client';
import {
  PERMISSIONS,
  type EmployeeDirectoryOption,
  type EmployeeFormOption,
  type EmploymentApprovalSummary,
  type PartTimeRecordItem,
} from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { EmploymentApprovalRuntimeService } from '../employment-approvals/employment-approval-runtime.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartTimeRecordDto } from './dto/create-part-time-record.dto';
import { EndPartTimeRecordDto } from './dto/end-part-time-record.dto';
import { QueryPartTimeRecordsDto } from './dto/query-part-time-records.dto';

const PART_TIME_BUSINESS_TYPE = 'PART_TIME_RECORD';
const NON_TERMINAL_STATUSES: PartTimeRecordStatus[] = [
  PartTimeRecordStatus.DRAFT,
  PartTimeRecordStatus.PENDING,
  PartTimeRecordStatus.PENDING_EFFECTIVE,
  PartTimeRecordStatus.ACTIVE,
];

type PartTimeRow = Prisma.PartTimeRecordGetPayload<{
  include: {
    employee: { select: { id: true; employeeNo: true; name: true } };
    organization: { select: { id: true; name: true } };
    jobTitle: { select: { id: true; code: true; name: true } };
    managerEmployee: { select: { id: true; employeeNo: true; name: true } };
    approvalRequest: {
      include: {
        steps: {
          include: { approver: { select: { id: true; displayName: true } } };
        };
      };
    };
  };
}>;

type TransactionalApprovalRuntime = EmploymentApprovalRuntimeService & {
  createRequestInTransaction(
    tx: Prisma.TransactionClient,
    input: Parameters<EmploymentApprovalRuntimeService['createRequest']>[0],
  ): ReturnType<EmploymentApprovalRuntimeService['createRequest']>;
  completeEffectiveInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
  ): ReturnType<EmploymentApprovalRuntimeService['completeEffective']>;
};

@Injectable()
export class PartTimeRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly runtime: EmploymentApprovalRuntimeService,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreatePartTimeRecordDto) {
    this.assertPermission(user, PERMISSIONS.EMPLOYEE_UPDATE);
    const input = this.normalizeCreateInput(dto);
    const startDate = parseDateOnly(input.startDate);
    const endDate = input.endDate ? parseDateOnly(input.endDate) : null;
    this.assertDateRange(startDate, endDate);
    this.assertStartDateNotBeforeToday(startDate);
    await this.access.assertOrganizationAccess(user, input.organizationId);

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          id: input.employeeId,
          recordStatus: RecordStatus.ACTIVE,
          archivedAt: null,
          ...(this.access.hasAllEmployeeData(user)
            ? {}
            : await this.access.getEmployeeWhere(user)),
        },
        select: { id: true, employeeNo: true, name: true },
      });
      if (!employee) throw new NotFoundException('员工不存在、已停用或不在当前数据范围内');

      const organization = await tx.organization.findFirst({
        where: { id: input.organizationId, status: RecordStatus.ACTIVE, archivedAt: null },
        select: { id: true, name: true },
      });
      if (!organization) throw new NotFoundException('兼职职责部门不存在或已停用');

      if (input.jobTitleId) {
        const jobTitle = await tx.jobTitle.findFirst({
          where: { id: input.jobTitleId, status: RecordStatus.ACTIVE, archivedAt: null },
          select: { id: true },
        });
        if (!jobTitle) throw new NotFoundException('兼职职务不存在或已停用');
      }

      if (input.managerEmployeeId) {
        if (input.managerEmployeeId === input.employeeId) {
          throw new BadRequestException('兼职经理不能是本人');
        }
        const manager = await tx.employee.findFirst({
          where: {
            id: input.managerEmployeeId,
            recordStatus: RecordStatus.ACTIVE,
            archivedAt: null,
          },
          select: { id: true },
        });
        if (!manager) throw new BadRequestException('兼职经理不存在或已停用');
      }

      await this.assertNoOverlap(tx, input, startDate, endDate);
      const record = await tx.partTimeRecord.create({
        data: {
          employeeId: input.employeeId,
          type: input.type,
          institution: input.institution,
          organizationId: input.organizationId,
          jobTitleId: input.jobTitleId,
          managerEmployeeId: input.managerEmployeeId,
          startDate,
          endDate,
          status: PartTimeRecordStatus.PENDING,
        },
        include: this.recordInclude(),
      });

      const approval = await (this.runtime as TransactionalApprovalRuntime).createRequestInTransaction(tx, {
        businessType: PART_TIME_BUSINESS_TYPE,
        businessId: record.id,
        applicantUserId: user.id,
        title: `${employee.name ?? employee.employeeNo}兼职职责申请`,
      });
      const linked = await tx.partTimeRecord.updateMany({
        where: { id: record.id, status: PartTimeRecordStatus.PENDING, approvalRequestId: null },
        data: { approvalRequestId: approval.id },
      });
      if (linked.count !== 1) throw new ConflictException('兼职记录已被其他操作更新，请刷新后重试');

      await this.audit.create(
        { userId: user.id },
        AuditAction.CREATE,
        record.id,
        {
          resource: 'part-time-record',
          action: 'create',
          businessType: PART_TIME_BUSINESS_TYPE,
          approvalRequestId: approval.id,
          status: PartTimeRecordStatus.PENDING,
        },
        tx,
        'part-time-record',
      );
      return { ...record, approvalRequestId: approval.id, status: PartTimeRecordStatus.PENDING };
    });
  }

  async findAll(user: AuthenticatedUser, query: QueryPartTimeRecordsDto): Promise<{
    data: PartTimeRecordItem[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    this.assertPermission(user, PERMISSIONS.EMPLOYEE_READ);
    const employeeScope = this.access.hasAllEmployeeData(user)
      ? {}
      : await this.access.getEmployeeWhere(user);
    if (query.organizationId) await this.access.assertOrganizationAccess(user, query.organizationId);
    const organizationScope = query.organizationId
      ? { organizationId: query.organizationId }
      : await this.getTargetOrganizationScope(user);
    const viewWhere = this.partTimeViewWhere(query.view, shanghaiBusinessDate());
    const where: Prisma.PartTimeRecordWhereInput = {
      archivedAt: null,
      ...viewWhere,
      ...(query.status ? { status: query.status } : {}),
      ...organizationScope,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null, ...employeeScope } },
      ...(query.keyword ? {
        OR: [
          { employee: { is: { name: { contains: query.keyword } } } },
          { employee: { is: { employeeNo: { contains: query.keyword } } } },
        ],
      } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.partTimeRecord.findMany({
        where,
        include: this.recordInclude(),
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.partTimeRecord.count({ where }),
    ]);
    const visibleData = await this.sanitizeManagerEmployees(user, data as PartTimeRow[], employeeScope);
    return {
      data: visibleData.map((row) => this.presentRecord(user, row)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    this.assertPermission(user, PERMISSIONS.EMPLOYEE_READ);
    const employeeScope = this.access.hasAllEmployeeData(user)
      ? {}
      : await this.access.getEmployeeWhere(user);
    const row = await this.prisma.partTimeRecord.findFirst({
      where: {
        id,
        archivedAt: null,
        ...await this.getTargetOrganizationScope(user),
        employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null, ...employeeScope } },
      },
      include: this.recordInclude(),
    });
    if (!row) throw new NotFoundException('兼职记录不存在或不在当前数据范围内');
    const [visibleRow] = await this.sanitizeManagerEmployees(user, [row as PartTimeRow], employeeScope);
    return this.presentRecord(user, visibleRow!);
  }

  async activate(user: AuthenticatedUser, id: string) {
    this.assertPermission(user, PERMISSIONS.EMPLOYEE_UPDATE);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.findManageableRecord(tx, user, id);
      if (row.status === PartTimeRecordStatus.ACTIVE) return row;
      if (row.status !== PartTimeRecordStatus.PENDING_EFFECTIVE) {
        throw new ConflictException('仅最终审批通过且待生效的兼职记录可以生效');
      }
      if (!row.approvalRequest
        || row.approvalRequest.status !== ProcessStatus.APPROVED
        || row.approvalRequest.employmentStatus !== EmploymentApplicationStatus.PENDING_EFFECTIVE) {
        throw new ConflictException('兼职审批尚未最终通过');
      }
      const today = shanghaiBusinessDate();
      if (row.startDate > today) throw new ConflictException('兼职开始日期未到，暂不能生效');
      const updated = await tx.partTimeRecord.updateMany({
        where: {
          id,
          status: PartTimeRecordStatus.PENDING_EFFECTIVE,
          archivedAt: null,
        },
        data: { status: PartTimeRecordStatus.ACTIVE },
      });
      if (updated.count !== 1) throw new ConflictException('兼职记录已被其他操作更新，请刷新后重试');
      if (!row.approvalRequestId) throw new ConflictException('兼职记录缺少审批申请');
      await (this.runtime as TransactionalApprovalRuntime).completeEffectiveInTransaction(tx, row.approvalRequestId);
      await this.audit.create(
        { userId: user.id },
        AuditAction.UPDATE,
        id,
        {
          resource: 'part-time-record',
          action: 'activate',
          fromStatus: PartTimeRecordStatus.PENDING_EFFECTIVE,
          toStatus: PartTimeRecordStatus.ACTIVE,
          approvalRequestId: row.approvalRequestId,
        },
        tx,
        'part-time-record',
      );
      return { ...row, status: PartTimeRecordStatus.ACTIVE };
    });
  }

  async end(user: AuthenticatedUser, id: string, dto: EndPartTimeRecordDto) {
    this.assertPermission(user, PERMISSIONS.EMPLOYEE_UPDATE);
    const endDate = parseDateOnly(dto.endDate);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.findManageableRecord(tx, user, id);
      if (row.status === PartTimeRecordStatus.ENDED) return row;
      if (row.status !== PartTimeRecordStatus.ACTIVE) {
        throw new ConflictException('仅生效中的兼职记录可以结束');
      }
      if (endDate < row.startDate) throw new BadRequestException('结束日期不能早于开始日期');
      const updated = await tx.partTimeRecord.updateMany({
        where: { id, status: PartTimeRecordStatus.ACTIVE, archivedAt: null },
        data: { endDate, status: PartTimeRecordStatus.ENDED },
      });
      if (updated.count !== 1) throw new ConflictException('兼职记录已被其他操作更新，请刷新后重试');
      await this.audit.create(
        { userId: user.id },
        AuditAction.UPDATE,
        id,
        {
          resource: 'part-time-record',
          action: 'end',
          fromStatus: PartTimeRecordStatus.ACTIVE,
          toStatus: PartTimeRecordStatus.ENDED,
          endDate: dto.endDate,
        },
        tx,
        'part-time-record',
      );
      return { ...row, endDate, status: PartTimeRecordStatus.ENDED };
    });
  }

  private partTimeViewWhere(
    view: QueryPartTimeRecordsDto['view'],
    businessDate: Date,
  ): Prisma.PartTimeRecordWhereInput {
    const inThirtyDays = new Date(businessDate);
    inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 30);
    switch (view ?? 'active') {
      case 'active':
        return {
          status: PartTimeRecordStatus.ACTIVE,
          startDate: { lte: businessDate },
          OR: [{ endDate: null }, { endDate: { gte: businessDate } }],
        };
      case 'expiring':
        return {
          status: PartTimeRecordStatus.ACTIVE,
          startDate: { lte: businessDate },
          endDate: { gte: businessDate, lte: inThirtyDays },
        };
      case 'not_started':
        return { status: PartTimeRecordStatus.PENDING_EFFECTIVE };
      case 'ended':
        return { status: PartTimeRecordStatus.ENDED };
      case 'approval':
        return { status: PartTimeRecordStatus.PENDING };
      case 'all':
        return {};
    }
  }

  private presentRecord(user: AuthenticatedUser, row: PartTimeRow): PartTimeRecordItem {
    const approval = row.approvalRequest?.archivedAt ? null : row.approvalRequest;
    const currentStep = approval?.steps?.find((step) => (
      step.stepOrder === approval.currentStep && step.decision === 'PENDING'
    ));
    const canActivate = this.access.hasPermission(user, PERMISSIONS.EMPLOYEE_UPDATE)
      && row.status === PartTimeRecordStatus.PENDING_EFFECTIVE
      && approval?.status === ProcessStatus.APPROVED
      && approval.employmentStatus === EmploymentApplicationStatus.PENDING_EFFECTIVE
      && row.startDate <= shanghaiBusinessDate();
    const canEnd = this.access.hasPermission(user, PERMISSIONS.EMPLOYEE_UPDATE)
      && row.status === PartTimeRecordStatus.ACTIVE;
    return {
      id: row.id,
      employee: row.employee,
      type: row.type,
      institution: row.institution,
      organization: row.organization as EmployeeFormOption,
      jobTitle: row.jobTitle as EmployeeDirectoryOption | null,
      managerEmployee: row.managerEmployee,
      startDate: formatDate(row.startDate)!,
      endDate: formatDate(row.endDate),
      status: row.status,
      approval: approval ? {
        id: approval.id,
        status: approval.status,
        employmentStatus: approval.employmentStatus ?? row.status as never,
        currentStep: approval.currentStep,
        currentApproverName: currentStep?.approver.displayName ?? null,
        submittedAt: approval.submittedAt?.toISOString() ?? null,
        completedAt: approval.completedAt?.toISOString() ?? null,
      } as EmploymentApprovalSummary : null,
      canActivate,
      canEnd,
    };
  }

  private async sanitizeManagerEmployees(
    user: AuthenticatedUser,
    rows: PartTimeRow[],
    employeeScope: Prisma.EmployeeWhereInput,
  ): Promise<PartTimeRow[]> {
    if (this.access.hasAllEmployeeData(user)) return rows;

    const managerIds = [...new Set(rows
      .map((row) => row.managerEmployeeId)
      .filter((id): id is string => Boolean(id)))];
    if (managerIds.length === 0) return rows;

    const authorizedManagers = await this.prisma.employee.findMany({
      where: {
        AND: [
          { id: { in: managerIds } },
          { recordStatus: RecordStatus.ACTIVE, archivedAt: null },
          employeeScope,
        ],
      },
      select: { id: true },
    });
    const authorizedManagerIds = new Set(authorizedManagers.map(({ id }) => id));
    return rows.map((row) => authorizedManagerIds.has(row.managerEmployeeId ?? '')
      ? row
      : { ...row, managerEmployeeId: null, managerEmployee: null });
  }

  private async findManageableRecord(
    client: Pick<Prisma.TransactionClient, 'partTimeRecord'>,
    user: AuthenticatedUser,
    id: string,
  ): Promise<PartTimeRow> {
    const employeeScope = this.access.hasAllEmployeeData(user)
      ? {}
      : await this.access.getEmployeeWhere(user);
    const row = await client.partTimeRecord.findFirst({
      where: {
        id,
        archivedAt: null,
        ...await this.getTargetOrganizationScope(user),
        employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null, ...employeeScope } },
      },
      include: this.recordInclude(),
    });
    if (!row) throw new NotFoundException('兼职记录不存在或不在当前数据范围内');
    return row as PartTimeRow;
  }

  private async assertNoOverlap(
    client: Pick<Prisma.TransactionClient, 'partTimeRecord'>,
    input: NormalizedCreateInput,
    startDate: Date,
    endDate: Date | null,
  ) {
    const candidates = await client.partTimeRecord.findMany({
      where: {
        employeeId: input.employeeId,
        institution: input.institution,
        organizationId: input.organizationId,
        jobTitleId: input.jobTitleId,
        archivedAt: null,
        status: { in: NON_TERMINAL_STATUSES },
        startDate: endDate ? { lte: endDate } : undefined,
        OR: [
          { endDate: null },
          { endDate: { gte: startDate } },
        ],
      },
      select: { id: true },
      take: 1,
    });
    if (candidates.length > 0) throw new ConflictException('相同员工、机构、部门和职务的兼职日期存在重叠');
  }

  private normalizeCreateInput(dto: CreatePartTimeRecordDto): NormalizedCreateInput {
    const type = dto.type?.trim();
    const organizationId = dto.organizationId?.trim();
    const employeeId = dto.employeeId?.trim();
    const startDate = dto.startDate?.trim();
    const endDate = dto.endDate?.trim() || null;
    const institution = dto.institution?.trim() || null;
    const jobTitleId = dto.jobTitleId?.trim() || null;
    const managerEmployeeId = dto.managerEmployeeId?.trim() || null;
    if (!type || !employeeId || !organizationId || !startDate) {
      throw new BadRequestException('员工、兼职类型、职责部门和开始日期不能为空');
    }
    return { employeeId, type, institution, organizationId, jobTitleId, managerEmployeeId, startDate, endDate };
  }

  private assertPermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission as never)) throw new ForbiddenException('无权执行该兼职操作');
  }

  private assertDateRange(startDate: Date, endDate: Date | null) {
    if (endDate && endDate < startDate) throw new BadRequestException('结束日期不能早于开始日期');
  }

  private assertStartDateNotBeforeToday(startDate: Date) {
    if (startDate < shanghaiBusinessDate()) throw new BadRequestException('开始日期只能为今天或未来日期');
  }

  private async getTargetOrganizationScope(user: AuthenticatedUser) {
    if (this.access.hasAllEmployeeData(user)) return {};
    return { organizationId: { in: await this.access.getAccessibleOrganizationIds(user) ?? [] } };
  }

  private recordInclude(): Prisma.PartTimeRecordInclude {
    return {
      employee: { select: { id: true, employeeNo: true, name: true } },
      organization: { select: { id: true, name: true } },
      jobTitle: { select: { id: true, code: true, name: true } },
      managerEmployee: { select: { id: true, employeeNo: true, name: true } },
      approvalRequest: {
        include: {
          steps: {
            where: { decision: 'PENDING' },
            orderBy: { stepOrder: 'asc' },
            include: { approver: { select: { id: true, displayName: true } } },
          },
        },
      },
    };
  }
}

interface NormalizedCreateInput {
  employeeId: string;
  type: string;
  institution: string | null;
  organizationId: string;
  jobTitleId: string | null;
  managerEmployeeId: string | null;
  startDate: string;
  endDate: string | null;
}

function formatDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('业务日期必须为 YYYY-MM-DD');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new BadRequestException('业务日期无效');
  }
  return date;
}

function shanghaiBusinessDate(value = new Date()) {
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
