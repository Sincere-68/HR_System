import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { createTableExport } from '../common/table-export';
import {
  ApprovalDecision,
  AssignmentStatus,
  AuditAction,
  EmploymentRelationship,
  EmploymentStatus,
  Prisma,
  ProcessStatus,
  RecordStatus,
} from '@prisma/client';
import {
  type EmployeeExportInput,
  type EmployeeMovementListItem,
  type EmploymentRecordListItem,
  type InternListItem,
  type LaborWorkerListItem,
  type Paginated,
  type PartTimeListItem,
  PERMISSIONS,
  PROBATION_EXPORT_FIELDS,
  PROBATION_IMPORT_FIELDS,
  type ProbationExportFieldKey,
  type ProbationApproverOption,
  type ProbationEvaluationType,
  type ProbationImportFieldKey,
  type ProbationImportResult,
  type ProbationImportRowResult,
  type ProbationListItem,
  type RetirementListItem,
  type TerminationListItem,
  type TrialPostListItem,
} from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService, type DemoProbationRecord } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmProbationDto } from './dto/confirm-probation.dto';
import { QueryEmployeeMovementsDto } from './dto/query-employee-movements.dto';
import { QueryEmploymentRecordsDto } from './dto/query-employment-records.dto';
import { QueryInternsDto } from './dto/query-interns.dto';
import { QueryLaborWorkersDto } from './dto/query-labor-workers.dto';
import { QueryPartTimeDto } from './dto/query-part-time.dto';
import { QueryProbationDto } from './dto/query-probation.dto';
import { ProbationExportDto } from './dto/probation-transfer.dto';
import { QueryRetirementsDto } from './dto/query-retirements.dto';
import { QueryTrialPostDto } from './dto/query-trial-post.dto';
import { QueryTerminationsDto } from './dto/query-terminations.dto';
import { StartProbationEvaluationsDto } from './dto/start-probation-evaluations.dto';
import { StartProbationEvaluationDto } from './dto/start-probation-evaluation.dto';
import { StartProbationConfirmationsDto } from './dto/start-probation-confirmations.dto';
import { SubmitProbationConfirmationDto } from './dto/submit-probation-confirmation.dto';
import { TransferProbationApprovalDto } from './dto/transfer-probation-approval.dto';
import { UpdateProbationDto } from './dto/update-probation.dto';
import { presentEmploymentRecord } from './employment-record.presenter';
import { presentLaborWorker } from './labor-worker.presenter';
import { presentPartTime } from './part-time.presenter';
import { presentRetirement } from './retirement.presenter';
import { presentTermination } from './termination.presenter';
import { presentTrialPost } from './trial-post.presenter';

const ACTIVE_APPROVAL_STATUSES: ProcessStatus[] = [
  ProcessStatus.PENDING,
  ProcessStatus.IN_PROGRESS,
];

const PROBATION_CONFIRMATION_ELIGIBLE_STATUSES: ProcessStatus[] = [
  ProcessStatus.DRAFT,
  ProcessStatus.IN_PROGRESS,
];

const OPEN_PROBATION_STATUSES: ProcessStatus[] = [
  ProcessStatus.DRAFT,
  ProcessStatus.IN_PROGRESS,
  ProcessStatus.PENDING,
  ProcessStatus.APPROVED,
  ProcessStatus.REJECTED,
  ProcessStatus.WITHDRAWN,
];

const EDITABLE_PROBATION_STATUSES: ProcessStatus[] = [
  ProcessStatus.DRAFT,
  ProcessStatus.IN_PROGRESS,
  ProcessStatus.PENDING,
  ProcessStatus.APPROVED,
];

const PROBATION_RESULT = {
  RECOMMENDED_REGULAR: '建议转正',
  CONFIRMED_REGULAR: '已转正',
} as const;

const PROBATION_APPROVAL_BUSINESS_TYPE = 'PROBATION_REGULARIZATION';
const PROBATION_EXPORT_MAX_ROWS = 10_000;

const PROBATION_EVALUATION_NAMES: Record<ProbationEvaluationType, string> = {
  IN_PROBATION: '试用中考核',
  REGULARIZATION: '转正考核',
};

type ProbationImportAction = 'CREATED' | 'UPDATED';

interface ProbationImportInput {
  employeeNo: string;
  employeeName?: string;
  departmentName?: string;
  positionName?: string;
  startDate: Date;
  plannedEndDate: Date;
  probationMonths?: number;
}

interface ProbationImportTarget {
  employeeId: string;
  employmentPeriodId: string;
  employeeName: string | null;
  departmentName: string;
  positionName: string | null;
}

function utcCalendarDay(value = new Date()) {
  return new Date(Date.UTC(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ));
}

@Injectable()
export class EmploymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly demo: DemoDataService,
    private readonly audit?: AuditService,
  ) {}

  async findEmploymentRecords(
    user: AuthenticatedUser,
    query: QueryEmploymentRecordsDto,
  ): Promise<Paginated<EmploymentRecordListItem>> {
    if (this.demo.enabled) return this.emptyEmploymentRecordPage(query);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const now = new Date();
    const today = utcCalendarDay(now);
    let displayedOrganizationIds = hasAllEmployeeData ? undefined : accessibleOrganizationIds;
    if (query.organizationId) {
      displayedOrganizationIds = await this.access.getOrganizationSubtreeIds(
        query.organizationId,
        hasAllEmployeeData ? undefined : accessibleOrganizationIds,
      );
      if (displayedOrganizationIds.length === 0) return this.emptyEmploymentRecordPage(query);
    }

    const scopeConditions: Prisma.EmployeeAssignmentWhereInput[] = [];
    if (displayedOrganizationIds) {
      scopeConditions.push({ organizationId: { in: displayedOrganizationIds } });
    }
    const conditions: Prisma.EmployeeAssignmentWhereInput[] = [
      ...scopeConditions,
      ...(query.view === 'current'
        ? [
            { archivedAt: null },
            { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
          ]
        : []),
    ];
    if (query.view === 'current') {
      conditions.push(
        { status: AssignmentStatus.ACTIVE },
        { startDate: { lte: today } },
        { OR: [{ endDate: null }, { endDate: { gte: today } }] },
      );
    } else if (query.assignmentStatus) {
      conditions.push({ status: query.assignmentStatus });
    }
    if (query.keyword) {
      conditions.push({
        employee: {
          is: {
            OR: [
              { employeeNo: { contains: query.keyword } },
              { name: { contains: query.keyword } },
            ],
          },
        },
      });
    }
    if (query.startDateFrom || query.startDateTo) {
      conditions.push({
        startDate: {
          ...(query.startDateFrom ? { gte: new Date(query.startDateFrom) } : {}),
          ...(query.startDateTo ? { lte: new Date(query.startDateTo) } : {}),
        },
      });
    }
    if (query.personnelStatus) {
      if (query.view === 'current') {
        conditions.push({
          employee: {
            is: {
              employmentRecords: {
                some: { currentFlag: true, status: query.personnelStatus },
              },
            },
          },
        });
      } else {
        const statusRows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT assignment.id
          FROM employee_assignments AS assignment
          INNER JOIN employment_records AS record
            ON record.employee_id = assignment.employee_id
            AND (
              record.employment_period_id = assignment.employment_period_id
              OR (
                record.employment_period_id IS NULL
                AND assignment.employment_period_id IS NULL
              )
            )
          WHERE record.status = ${query.personnelStatus}
            AND record.effective_at <= assignment.start_date
            AND (record.ended_at IS NULL OR record.ended_at >= assignment.start_date)
        `);
        if (statusRows.length === 0) return this.emptyEmploymentRecordPage(query);
        conditions.push({ id: { in: statusRows.map(({ id }) => id) } });
      }
    }

    const where: Prisma.EmployeeAssignmentWhereInput = { AND: conditions };
    const assignmentSelect = Prisma.validator<Prisma.EmployeeAssignmentSelect>()({
      id: true,
      employeeId: true,
      employmentPeriodId: true,
      startDate: true,
      endDate: true,
      status: true,
      isPrimary: true,
      employmentPeriod: {
        select: {
          entryDate: true,
          employmentRecords: {
            select: { status: true, effectiveAt: true, endedAt: true },
            orderBy: [{ effectiveAt: 'desc' }, { id: 'asc' }],
          },
        },
      },
      employee: {
        select: {
          employeeNo: true,
          name: true,
          employmentRecords: {
            where: query.view === 'current'
              ? {
                  currentFlag: true,
                  ...(query.personnelStatus ? { status: query.personnelStatus } : {}),
                }
              : {
                  employmentPeriodId: null,
                  ...(query.personnelStatus ? { status: query.personnelStatus } : {}),
                },
            select: { status: true },
            orderBy: [{ effectiveAt: 'desc' }, { id: 'asc' }],
            take: 1,
          },
          convertedCandidates: {
            where: { archivedAt: null },
            select: { resumeAttachmentId: true },
          },
        },
      },
      organization: { select: { name: true } },
      position: { select: { name: true } },
    });
    const [rows, total, latestPrimaryRows] = await this.prisma.$transaction([
      this.prisma.employeeAssignment.findMany({
        where,
        select: assignmentSelect,
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeAssignment.count({ where }),
      this.prisma.employeeAssignment.findMany({
        where: { AND: [...scopeConditions, { isPrimary: true }] },
        select: { id: true, employeeId: true, employmentPeriodId: true, startDate: true },
        orderBy: [{ employeeId: 'asc' }, { employmentPeriodId: 'asc' }, { startDate: 'desc' }, { id: 'asc' }],
      }),
    ]);

    const latestPrimaryByPeriod = new Map<string, string>();
    latestPrimaryRows.forEach((row) => {
      const key = `${row.employeeId}:${row.employmentPeriodId ?? ''}`;
      if (!latestPrimaryByPeriod.has(key)) latestPrimaryByPeriod.set(key, row.id);
    });
    const detailEmployeeIds = new Set<string>();
    if (hasAllEmployeeData) {
      rows.forEach((row) => detailEmployeeIds.add(row.employeeId));
    } else if (rows.length > 0) {
      const detailWhere = await this.access.getEmployeeWhere(user, accessibleOrganizationIds, now);
      const detailRows = await this.prisma.employee.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.employeeId))] }, ...detailWhere },
        select: { id: true },
      });
      detailRows.forEach(({ id }) => detailEmployeeIds.add(id));
    }
    return {
      data: rows.map((row) => {
        const key = `${row.employeeId}:${row.employmentPeriodId ?? ''}`;
        return presentEmploymentRecord(row, {
          isLatestPrimaryRecord: row.isPrimary && latestPrimaryByPeriod.get(key) === row.id,
          canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
          view: query.view,
        });
      }),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findInterns(user: AuthenticatedUser, query: QueryInternsDto): Promise<Paginated<InternListItem>> {
    if (query.view === 'conversion_pending') {
      throw new ConflictException('实习转正中视图暂不可用：尚未确认转换事件来源');
    }
    if (query.view === 'converted') {
      throw new ConflictException('实习已转正视图暂不可用：尚未确认转换事件来源');
    }
    if (this.demo.enabled) return this.emptyInternPage(query);
    if (query.view === 'resigned') return this.findResignedInterns(user, query);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const now = new Date();
    const today = utcCalendarDay(now);
    const conditions: Prisma.EmploymentPeriodWhereInput[] = [
      { employmentRelationship: EmploymentRelationship.INTERN },
      { employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] } },
      { actualExitDate: null },
      { entryDate: { lte: today } },
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
    ];
    if (!hasAllEmployeeData) {
      conditions.push({
        assignments: {
          some: {
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            organizationId: { in: accessibleOrganizationIds },
            startDate: { lte: today },
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
        },
      });
    }
    if (query.keyword) {
      conditions.push({
        employee: {
          is: {
            OR: [
              { employeeNo: { contains: query.keyword } },
              { name: { contains: query.keyword } },
            ],
          },
        },
      });
    }
    if (query.startDateFrom || query.startDateTo) {
      conditions.push({
        entryDate: {
          ...(query.startDateFrom ? { gte: new Date(query.startDateFrom) } : {}),
          ...(query.startDateTo ? { lte: new Date(query.startDateTo) } : {}),
        },
      });
    }

    const where: Prisma.EmploymentPeriodWhereInput = { AND: conditions };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employmentPeriod.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          entryDate: true,
          employee: { select: { name: true, workEmail: true } },
          assignments: {
            where: {
              status: AssignmentStatus.ACTIVE,
              archivedAt: null,
              startDate: { lte: today },
              OR: [{ endDate: null }, { endDate: { gte: today } }],
              ...(hasAllEmployeeData ? {} : { organizationId: { in: accessibleOrganizationIds } }),
            },
            orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
            take: 1,
            select: {
              organization: { select: { id: true, name: true } },
              position: { select: { name: true } },
            },
          },
        },
        orderBy: [{ entryDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employmentPeriod.count({ where }),
    ]);

    // Employee list visibility and employee-detail visibility are separate
    // checks. A visible internship period does not grant detail access when
    // the employee's current authorized assignment no longer matches scope.
    const detailEmployeeIds = new Set<string>();
    if (hasAllEmployeeData) {
      rows.forEach((row) => detailEmployeeIds.add(row.employeeId));
    } else if (rows.length > 0) {
      const detailWhere = await this.access.getEmployeeWhere(user, accessibleOrganizationIds, now);
      const detailRows = await this.prisma.employee.findMany({
        where: {
          AND: [
            { id: { in: [...new Set(rows.map((row) => row.employeeId))] } },
            detailWhere,
          ],
        },
        select: { id: true },
      });
      detailRows.forEach(({ id }) => detailEmployeeIds.add(id));
    }

    return {
      data: rows.map((row) => {
        const assignment = row.assignments[0];
        return {
          id: row.id,
          employeeId: row.employeeId,
          employeeName: row.employee.name ?? '--',
          workEmail: row.employee.workEmail,
          internshipOrganizationName: null,
          departmentName: assignment?.organization.name ?? null,
          positionName: assignment?.position?.name ?? null,
          startDate: row.entryDate?.toISOString().slice(0, 10) ?? null,
          approvalStatus: null,
          managerName: null,
          bankName: null,
          bankAccountNumber: null,
          bankBranchName: null,
          canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
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

  private async findResignedInterns(
    user: AuthenticatedUser,
    query: QueryInternsDto,
  ): Promise<Paginated<InternListItem>> {
    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    if (!hasAllEmployeeData && accessibleOrganizationIds.length === 0) {
      return this.emptyInternPage(query);
    }

    const visiblePeriodIds = hasAllEmployeeData
      ? undefined
      : await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT period.id
          FROM employment_periods AS period
          WHERE period.employment_relationship = ${EmploymentRelationship.INTERN}
            AND period.actual_exit_date IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM employee_assignments AS assignment
              WHERE assignment.employment_period_id = period.id
                AND assignment.organization_id IN (${Prisma.join(accessibleOrganizationIds)})
                AND assignment.status IN (${Prisma.join([AssignmentStatus.ACTIVE, AssignmentStatus.ENDED])})
                AND assignment.start_date <= period.actual_exit_date
                AND (assignment.end_date IS NULL OR assignment.end_date >= period.actual_exit_date)
            )
        `);
    if (visiblePeriodIds && visiblePeriodIds.length === 0) return this.emptyInternPage(query);

    const conditions: Prisma.EmploymentPeriodWhereInput[] = [
      { employmentRelationship: EmploymentRelationship.INTERN },
      { actualExitDate: { not: null } },
      ...(visiblePeriodIds ? [{ id: { in: visiblePeriodIds.map(({ id }) => id) } }] : []),
      ...(query.keyword ? [{
        employee: {
          is: {
            OR: [
              { employeeNo: { contains: query.keyword } },
              { name: { contains: query.keyword } },
            ],
          },
        },
      }] : []),
    ];
    if (query.startDateFrom || query.startDateTo) {
      conditions.push({
        entryDate: {
          ...(query.startDateFrom ? { gte: new Date(query.startDateFrom) } : {}),
          ...(query.startDateTo ? { lte: new Date(query.startDateTo) } : {}),
        },
      });
    }
    const where: Prisma.EmploymentPeriodWhereInput = { AND: conditions };
    const assignmentWhere: Prisma.EmployeeAssignmentWhereInput = {
      status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
      ...(hasAllEmployeeData ? {} : { organizationId: { in: accessibleOrganizationIds } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employmentPeriod.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          entryDate: true,
          actualExitDate: true,
          employee: { select: { name: true, workEmail: true } },
          assignments: {
            where: assignmentWhere,
            orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
            select: {
              id: true,
              startDate: true,
              endDate: true,
              organization: { select: { id: true, name: true } },
              position: { select: { name: true } },
            },
          },
        },
        orderBy: [{ actualExitDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employmentPeriod.count({ where }),
    ]);

    const now = new Date();
    const detailEmployeeIds = new Set<string>();
    if (hasAllEmployeeData) {
      rows.forEach((row) => detailEmployeeIds.add(row.employeeId));
    } else if (rows.length > 0) {
      const detailWhere = await this.access.getEmployeeWhere(user, accessibleOrganizationIds, now);
      const detailRows = await this.prisma.employee.findMany({
        where: {
          AND: [
            { id: { in: [...new Set(rows.map((row) => row.employeeId))] } },
            detailWhere,
          ],
        },
        select: { id: true },
      });
      detailRows.forEach(({ id }) => detailEmployeeIds.add(id));
    }

    return {
      data: rows.map((row) => {
        const assignment = row.assignments.find((candidate) => (
          !row.actualExitDate
          || (!candidate.startDate || candidate.startDate <= row.actualExitDate)
          && (!candidate.endDate || candidate.endDate >= row.actualExitDate)
        )) ?? row.assignments[0];
        return {
          id: row.id,
          employeeId: row.employeeId,
          employeeName: row.employee.name ?? '--',
          workEmail: row.employee.workEmail,
          internshipOrganizationName: null,
          departmentName: assignment?.organization.name ?? null,
          positionName: assignment?.position?.name ?? null,
          startDate: row.entryDate?.toISOString().slice(0, 10) ?? null,
          approvalStatus: null,
          managerName: null,
          bankName: null,
          bankAccountNumber: null,
          bankBranchName: null,
          canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
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

  async exportInterns(user: AuthenticatedUser, dto: EmployeeExportInput) {
    const query = dto.query ?? {};
    const result = await this.findInterns(user, {
      keyword: query.keyword ?? query.name,
      startDateFrom: (query as { startDateFrom?: string }).startDateFrom,
      startDateTo: (query as { startDateTo?: string }).startDateTo,
      page: 1,
      pageSize: 10_000,
    } as QueryInternsDto);
    const rows = dto.employeeIds?.length ? result.data.filter(({ id }) => dto.employeeIds!.includes(id)) : result.data;
    return createTableExport(rows, dto.fields, [
      ['employeeName', '姓名'], ['workEmail', '邮箱'], ['internshipOrganizationName', '实习机构'], ['departmentName', '实习部门'],
      ['positionName', '实习职位'], ['startDate', '实习开始日期'], ['approvalStatus', '审批状态'], ['managerName', '直线经理'],
      ['bankName', '银行'], ['bankAccountNumber', '银行账号'], ['bankBranchName', '开户行支行'],
    ].map(([key, title]) => ({ key: key!, title: title! })), dto.format, '实习生导出');
  }

  async findLaborWorkers(
    user: AuthenticatedUser,
    query: QueryLaborWorkersDto,
  ): Promise<Paginated<LaborWorkerListItem>> {
    if (query.view === 'conversion_pending') {
      throw new ConflictException('劳务转正式中视图暂不可用：尚未确认转换事件来源');
    }
    if (query.view === 'converted') {
      throw new ConflictException('劳务已转正式视图暂不可用：尚未确认转换事件来源');
    }
    if (this.demo.enabled) return this.emptyLaborWorkerPage(query);
    if (query.view === 'resigned') return this.findResignedLaborWorkers(user, query);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const now = new Date();
    const today = utcCalendarDay(now);
    const currentAssignment: Prisma.EmployeeAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
      ...(hasAllEmployeeData ? {} : { organizationId: { in: accessibleOrganizationIds } }),
    };
    const conditions: Prisma.EmploymentPeriodWhereInput[] = [
      { employmentRelationship: EmploymentRelationship.LABOR_WORKER },
      { employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] } },
      { actualExitDate: null },
      { entryDate: { lte: today } },
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
    ];
    if (!hasAllEmployeeData) {
      conditions.push({ assignments: { some: currentAssignment } });
    }
    if (query.keyword) {
      conditions.push({
        employee: {
          is: {
            OR: [
              { employeeNo: { contains: query.keyword } },
              { name: { contains: query.keyword } },
            ],
          },
        },
      });
    }
    if (query.entryDateFrom || query.entryDateTo) {
      conditions.push({
        entryDate: {
          ...(query.entryDateFrom ? { gte: new Date(query.entryDateFrom) } : {}),
          ...(query.entryDateTo ? { lte: new Date(query.entryDateTo) } : {}),
        },
      });
    }

    const where: Prisma.EmploymentPeriodWhereInput = { AND: conditions };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employmentPeriod.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          entryDate: true,
          employee: { select: { employeeNo: true, name: true, workEmail: true } },
          assignments: {
            where: currentAssignment,
            orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
            take: 1,
            select: {
              organization: { select: { name: true } },
              jobTitle: { select: { name: true } },
              workplaceName: true,
              workArrangement: true,
            },
          },
        },
        orderBy: [{ entryDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employmentPeriod.count({ where }),
    ]);

    const managerRows = await Promise.all(rows.map((row) => this.prisma.reportingRelationship.findFirst({
      where: {
        employeeId: row.employeeId,
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
        manager: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } },
      },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
      select: { manager: { select: { name: true } } },
    })));

    // Visibility of a labor period is based on that period's current authorized
    // assignment. The employee detail action separately follows the employee's
    // current data scope, which may have changed since the period became visible.
    const detailEmployeeIds = new Set<string>();
    if (hasAllEmployeeData) {
      rows.forEach((row) => detailEmployeeIds.add(row.employeeId));
    } else if (rows.length > 0) {
      const detailWhere = await this.access.getEmployeeWhere(user, accessibleOrganizationIds, now);
      const detailRows = await this.prisma.employee.findMany({
        where: {
          AND: [
            { id: { in: [...new Set(rows.map((row) => row.employeeId))] } },
            detailWhere,
          ],
        },
        select: { id: true },
      });
      detailRows.forEach(({ id }) => detailEmployeeIds.add(id));
    }

    return {
      data: rows.map((row, index) => presentLaborWorker(row, {
        managerName: managerRows[index]?.manager.name ?? null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  private async findResignedLaborWorkers(
    user: AuthenticatedUser,
    query: QueryLaborWorkersDto,
  ): Promise<Paginated<LaborWorkerListItem>> {
    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    if (!hasAllEmployeeData && accessibleOrganizationIds.length === 0) {
      return this.emptyLaborWorkerPage(query);
    }

    const visiblePeriodIds = hasAllEmployeeData
      ? undefined
      : await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT period.id
          FROM employment_periods AS period
          WHERE period.employment_relationship = ${EmploymentRelationship.LABOR_WORKER}
            AND period.actual_exit_date IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM employee_assignments AS assignment
              WHERE assignment.employment_period_id = period.id
                AND assignment.organization_id IN (${Prisma.join(accessibleOrganizationIds)})
                AND assignment.status IN (${Prisma.join([AssignmentStatus.ACTIVE, AssignmentStatus.ENDED])})
                AND assignment.start_date <= period.actual_exit_date
                AND (assignment.end_date IS NULL OR assignment.end_date >= period.actual_exit_date)
            )
        `);
    if (visiblePeriodIds && visiblePeriodIds.length === 0) return this.emptyLaborWorkerPage(query);

    const conditions: Prisma.EmploymentPeriodWhereInput[] = [
      { employmentRelationship: EmploymentRelationship.LABOR_WORKER },
      { actualExitDate: { not: null } },
      ...(visiblePeriodIds ? [{ id: { in: visiblePeriodIds.map(({ id }) => id) } }] : []),
      { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
    ];
    if (query.keyword) {
      conditions.push({
        employee: {
          is: {
            OR: [
              { employeeNo: { contains: query.keyword } },
              { name: { contains: query.keyword } },
            ],
          },
        },
      });
    }
    if (query.entryDateFrom || query.entryDateTo) {
      conditions.push({
        entryDate: {
          ...(query.entryDateFrom ? { gte: new Date(query.entryDateFrom) } : {}),
          ...(query.entryDateTo ? { lte: new Date(query.entryDateTo) } : {}),
        },
      });
    }

    const where: Prisma.EmploymentPeriodWhereInput = { AND: conditions };
    const assignmentWhere: Prisma.EmployeeAssignmentWhereInput = {
      status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
      ...(hasAllEmployeeData ? {} : { organizationId: { in: accessibleOrganizationIds } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employmentPeriod.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          entryDate: true,
          actualExitDate: true,
          employee: { select: { employeeNo: true, name: true, workEmail: true } },
          assignments: {
            where: assignmentWhere,
            orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
            select: {
              startDate: true,
              endDate: true,
              organization: { select: { name: true } },
              jobTitle: { select: { name: true } },
              workplaceName: true,
              workArrangement: true,
            },
          },
        },
        orderBy: [{ actualExitDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employmentPeriod.count({ where }),
    ]);

    const detailEmployeeIds = new Set<string>();
    if (hasAllEmployeeData) {
      rows.forEach((row) => detailEmployeeIds.add(row.employeeId));
    } else if (rows.length > 0) {
      const detailWhere = await this.access.getEmployeeWhere(user, accessibleOrganizationIds, new Date());
      const detailRows = await this.prisma.employee.findMany({
        where: {
          AND: [
            { id: { in: [...new Set(rows.map((row) => row.employeeId))] } },
            detailWhere,
          ],
        },
        select: { id: true },
      });
      detailRows.forEach(({ id }) => detailEmployeeIds.add(id));
    }

    const managerRows = await Promise.all(rows.map((row) => this.prisma.reportingRelationship.findFirst({
      where: {
        employeeId: row.employeeId,
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        startDate: { lte: row.actualExitDate ?? utcCalendarDay() },
        OR: [{ endDate: null }, { endDate: { gte: row.actualExitDate ?? utcCalendarDay() } }],
        manager: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } },
      },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
      select: { managerEmployeeId: true, manager: { select: { name: true } } },
    })));

    const visibleManagerIds = new Set<string>();
    if (hasAllEmployeeData) {
      managerRows.forEach((managerRow) => {
        if (managerRow?.managerEmployeeId) visibleManagerIds.add(managerRow.managerEmployeeId);
      });
    } else {
      await Promise.all(rows.map(async (row, index) => {
        const managerEmployeeId = managerRows[index]?.managerEmployeeId;
        if (!managerEmployeeId) return;
        const managerWhere = await this.access.getEmployeeWhere(
          user,
          accessibleOrganizationIds,
          row.actualExitDate ?? utcCalendarDay(),
        );
        const visibleManagers = await this.prisma.employee.findMany({
          where: {
            AND: [
              { id: { in: [managerEmployeeId] } },
              managerWhere,
            ],
          },
          select: { id: true },
        });
        if (visibleManagers.length > 0) visibleManagerIds.add(managerEmployeeId);
      }));
    }

    return {
      data: rows.map((row, index) => {
        const assignment = row.assignments.find((candidate) => (
          !row.actualExitDate
          || (!candidate.startDate || candidate.startDate <= row.actualExitDate)
          && (!candidate.endDate || candidate.endDate >= row.actualExitDate)
        )) ?? row.assignments[0];
        const managerRow = managerRows[index];
        return presentLaborWorker({
          id: row.id,
          employeeId: row.employeeId,
          entryDate: row.entryDate,
          employee: row.employee,
          assignments: assignment ? [assignment] : [],
        }, {
          managerName: managerRow && visibleManagerIds.has(managerRow.managerEmployeeId)
            ? managerRow.manager.name
            : null,
          canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
        });
      }),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findPartTime(user: AuthenticatedUser, query: QueryPartTimeDto): Promise<Paginated<PartTimeListItem>> {
    if (query.view === 'approval_pending') {
      throw new ConflictException('兼职审批中视图暂不可用：尚未确认兼职申请与审批来源');
    }
    if (query.view === 'expiring') {
      throw new ConflictException('兼职即将到期视图暂不可用：尚未确认预警窗口规则');
    }
    if (this.demo.enabled) return this.emptyPartTimePage(query);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const today = utcCalendarDay();
    const view = query.view ?? 'active';
    const conditions: Prisma.EmployeeAssignmentWhereInput[] = [
      { workArrangement: 'PART_TIME' },
      ...(view === 'ended'
        ? [{ status: AssignmentStatus.ENDED }, { endDate: { lt: today } }]
        : view === 'not_started'
          ? [{ status: AssignmentStatus.ACTIVE }, { startDate: { gt: today } }]
          : view === 'all'
            ? [{ status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] } }]
            : [
                { status: AssignmentStatus.ACTIVE },
                { startDate: { lte: today } },
                { OR: [{ endDate: null }, { endDate: { gte: today } }] },
              ]),
      { archivedAt: null },
      { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
    ];
    if (!hasAllEmployeeData) conditions.push({ organizationId: { in: accessibleOrganizationIds } });
    if (query.assignmentType) conditions.push({ assignmentType: query.assignmentType });
    if (query.keyword) {
      conditions.push({
        employee: {
          is: { OR: [{ employeeNo: { contains: query.keyword } }, { name: { contains: query.keyword } }] },
        },
      });
    }
    if (query.startDateFrom || query.startDateTo) {
      conditions.push({
        startDate: {
          ...(query.startDateFrom ? { gte: new Date(query.startDateFrom) } : {}),
          ...(query.startDateTo ? { lte: new Date(query.startDateTo) } : {}),
        },
      });
    }
    if (query.endDateFrom || query.endDateTo) {
      conditions.push({
        endDate: {
          ...(query.endDateFrom ? { gte: new Date(query.endDateFrom) } : {}),
          ...(query.endDateTo ? { lte: new Date(query.endDateTo) } : {}),
        },
      });
    }

    const where: Prisma.EmployeeAssignmentWhereInput = { AND: conditions };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeAssignment.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          startDate: true,
          endDate: true,
          status: true,
          employee: { select: { employeeNo: true, name: true } },
          organization: { select: { name: true } },
          jobTitle: { select: { name: true } },
        },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeAssignment.count({ where }),
    ]);
    const detailEmployeeIds = new Set<string>();
    if (hasAllEmployeeData) {
      rows.forEach((row) => detailEmployeeIds.add(row.employeeId));
    } else if (rows.length > 0) {
      const detailWhere = await this.access.getEmployeeWhere(user, accessibleOrganizationIds, new Date());
      const detailRows = await this.prisma.employee.findMany({
        where: {
          AND: [
            { id: { in: [...new Set(rows.map((row) => row.employeeId))] } },
            detailWhere,
          ],
        },
        select: { id: true },
      });
      detailRows.forEach(({ id }) => detailEmployeeIds.add(id));
    }
    return {
      data: rows.map((row) => presentPartTime(row, detailEmployeeIds.has(row.employeeId))),
      meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    };
  }

  async findProbation(
    user: AuthenticatedUser,
    query: QueryProbationDto,
    selectedProbationIds: readonly string[] = [],
  ): Promise<Paginated<ProbationListItem>> {
    if (this.demo.enabled) return this.findDemoProbation(user, query, selectedProbationIds);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const now = new Date();
    const today = utcCalendarDay(now);
    const conditions: Prisma.ProbationRecordWhereInput[] = [
      { archivedAt: null },
      { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
    ];
    let displayedOrganizationIds = hasAllEmployeeData ? undefined : accessibleOrganizationIds;
    if (query.organizationId) {
      displayedOrganizationIds = await this.access.getOrganizationSubtreeIds(
        query.organizationId,
        hasAllEmployeeData ? undefined : accessibleOrganizationIds,
      );
      if (displayedOrganizationIds.length === 0) return this.emptyPage(query);
    }
    if (displayedOrganizationIds) {
      if (displayedOrganizationIds.length === 0) return this.emptyPage(query);
      const visibleRows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT probation.id
        FROM probation_records AS probation
        WHERE probation.employment_period_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM employee_assignments AS assignment
            WHERE assignment.employee_id = probation.employee_id
              AND assignment.employment_period_id = probation.employment_period_id
              AND assignment.organization_id IN (${Prisma.join(displayedOrganizationIds)})
              AND assignment.archived_at IS NULL
              AND assignment.status IN (${Prisma.join([
                AssignmentStatus.ACTIVE,
                AssignmentStatus.ENDED,
              ])})
              AND assignment.start_date <= probation.start_date
              AND (assignment.end_date IS NULL OR assignment.end_date >= probation.start_date)
          )
      `);
      if (visibleRows.length === 0) return this.emptyPage(query);
      conditions.push({ id: { in: visibleRows.map(({ id }) => id) } });
    }
    if (query.keyword) conditions.push({ employee: { is: { OR: [{ employeeNo: { contains: query.keyword } }, { name: { contains: query.keyword } }] } } });
    if (query.probationMonths !== undefined) conditions.push({ probationMonths: query.probationMonths });
    if (query.view !== 'completed') {
      conditions.push({
        employmentPeriod: {
          is: {
            employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
            employmentStatus: EmploymentStatus.PROBATION,
            actualExitDate: null,
            status: RecordStatus.ACTIVE,
            archivedAt: null,
          },
        },
      });
    }
    if (query.view === 'expiring') {
      const inThirtyDays = new Date(today);
      inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + (query.expiresWithinDays ?? 30));
      conditions.push({
        status: ProcessStatus.DRAFT,
        plannedEndDate: { gte: today, lte: inThirtyDays },
      });
    } else if (query.view === 'reviewing') {
      conditions.push({ status: ProcessStatus.IN_PROGRESS });
    } else if (query.view === 'approval') {
      conditions.push({ status: ProcessStatus.PENDING });
    } else if (query.view === 'completed') {
      conditions.push({ status: ProcessStatus.COMPLETED });
    } else if (query.view === 'all') {
      conditions.push({ status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.CANCELLED] } });
    }
    if (query.status) conditions.push({ status: query.status });
    if (query.startDateFrom || query.startDateTo) {
      conditions.push({
        startDate: {
          ...(query.startDateFrom
            ? { gte: this.parseProbationDate(query.startDateFrom, '试用开始日期') }
            : {}),
          ...(query.startDateTo
            ? { lte: this.parseProbationDate(query.startDateTo, '试用开始日期') }
            : {}),
        },
      });
    }
    if (query.plannedEndDateFrom || query.plannedEndDateTo) {
      conditions.push({
        plannedEndDate: {
          ...(query.plannedEndDateFrom
            ? { gte: this.parseProbationDate(query.plannedEndDateFrom, '预计试用结束日期') }
            : {}),
          ...(query.plannedEndDateTo
            ? { lte: this.parseProbationDate(query.plannedEndDateTo, '预计试用结束日期') }
            : {}),
        },
      });
    }
    if (selectedProbationIds.length > 0) {
      conditions.push({ id: { in: [...selectedProbationIds] } });
    }
    const where: Prisma.ProbationRecordWhereInput = { AND: conditions };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.probationRecord.findMany({
        where,
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
          employee: { select: { employeeNo: true, name: true } },
          employmentPeriod: {
            select: {
              agreements: {
                where: { archivedAt: null },
                select: {
                  startDate: true,
                  endDate: true,
                  terminationDate: true,
                  employingCompany: { select: { name: true } },
                },
                orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
              },
            },
          },
        },
        orderBy: [{ plannedEndDate: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.probationRecord.count({ where }),
    ]);
    const rowsWithEmploymentPeriods = rows.filter(
      (row): row is (typeof rows)[number] & { employmentPeriodId: string } =>
        row.employmentPeriodId !== null,
    );
    const employmentPeriodIds = [...new Set(
      rowsWithEmploymentPeriods.map((row) => row.employmentPeriodId),
    )];
    const firstProbationStart = rowsWithEmploymentPeriods[0]?.startDate ?? new Date();
    const earliestProbationStart = rowsWithEmploymentPeriods.reduce(
      (earliest, row) => (row.startDate < earliest ? row.startDate : earliest),
      firstProbationStart,
    );
    const latestProbationStart = rowsWithEmploymentPeriods.reduce(
      (latest, row) => (row.startDate > latest ? row.startDate : latest),
      firstProbationStart,
    );
    const assignments = employmentPeriodIds.length === 0
      ? []
      : await this.prisma.employeeAssignment.findMany({
          where: {
            employmentPeriodId: { in: employmentPeriodIds },
            archivedAt: null,
            status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
            startDate: { lte: latestProbationStart },
            OR: [{ endDate: null }, { endDate: { gte: earliestProbationStart } }],
            ...(displayedOrganizationIds ? { organizationId: { in: displayedOrganizationIds } } : {}),
          },
          select: {
            id: true,
            employeeId: true,
            employmentPeriodId: true,
            startDate: true,
            endDate: true,
            isPrimary: true,
            organization: { select: { name: true } },
            position: { select: { name: true } },
            jobTitle: { select: { name: true } },
          },
          orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
        });
    const assignmentsByEmploymentPeriod = new Map<string, typeof assignments>();
    assignments.forEach((assignment) => {
      if (!assignment.employmentPeriodId) return;
      const current = assignmentsByEmploymentPeriod.get(assignment.employmentPeriodId) ?? [];
      current.push(assignment);
      assignmentsByEmploymentPeriod.set(assignment.employmentPeriodId, current);
    });
    const effectiveAssignments = rows.map((row) => {
      if (!row.employmentPeriodId) return null;
      return assignmentsByEmploymentPeriod.get(row.employmentPeriodId)?.find((assignment) => (
        assignment.employeeId === row.employeeId
        && assignment.startDate !== null
        && assignment.startDate <= row.startDate
        && (assignment.endDate === null || assignment.endDate >= row.startDate)
      )) ?? null;
    });
    const approvalRows = rows.length === 0
      ? []
      : await this.prisma.approvalRequest.findMany({
          where: {
            businessType: PROBATION_APPROVAL_BUSINESS_TYPE,
            businessId: { in: rows.map(({ id }) => id) },
            archivedAt: null,
          },
          select: {
            businessId: true,
            status: true,
            currentStep: true,
            updatedAt: true,
            steps: {
                where: { decision: ApprovalDecision.PENDING },
                select: {
                  stepOrder: true,
                  approverUserId: true,
                  approver: {
                    select: {
                      displayName: true,
                    employee: { select: { workEmail: true } },
                  },
                },
              },
            },
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        });
    const approvalByProbationId = new Map<string, typeof approvalRows[number]>();
    approvalRows.forEach((approval) => {
      if (approval.businessId && !approvalByProbationId.has(approval.businessId)) {
        approvalByProbationId.set(approval.businessId, approval);
      }
    });
    const detailEmployeeIds = new Set<string>();
    if (hasAllEmployeeData) {
      rows.forEach((row) => detailEmployeeIds.add(row.employeeId));
    } else if (rows.length > 0) {
      const detailWhere = await this.access.getEmployeeWhere(user, accessibleOrganizationIds, now);
      const detailRows = await this.prisma.employee.findMany({
        where: {
          AND: [
            { id: { in: [...new Set(rows.map((row) => row.employeeId))] } },
            detailWhere,
          ],
        },
        select: { id: true },
      });
      detailRows.forEach(({ id }) => detailEmployeeIds.add(id));
    }
    return {
      data: rows.map((row, index) => {
        const approval = approvalByProbationId.get(row.id);
        const currentStep = approval?.steps.find((step) => step.stepOrder === approval.currentStep);
        const canManage = this.access.hasPermission(user, PERMISSIONS.EMPLOYEE_UPDATE)
          && detailEmployeeIds.has(row.employeeId);
        return {
          id: row.id,
          employeeId: row.employeeId,
          employeeNo: row.employee.employeeNo,
          employeeName: row.employee.name ?? '--',
          organizationName: this.probationOrganizationName(
            row.employmentPeriod?.agreements ?? [],
            row.startDate,
          ),
          departmentName: effectiveAssignments[index]?.organization.name ?? null,
          positionName: effectiveAssignments[index]?.position?.name ?? null,
          jobTitleName: effectiveAssignments[index]?.jobTitle?.name ?? null,
          startDate: row.startDate.toISOString().slice(0, 10),
          plannedEndDate: row.plannedEndDate.toISOString().slice(0, 10),
          probationMonths: row.probationMonths,
          actualEndDate: row.actualEndDate?.toISOString().slice(0, 10) ?? null,
          evaluationType: this.normalizeProbationEvaluationType(row.evaluationType),
          evaluationName: this.probationEvaluationName(row.evaluationType),
          result: row.result,
          evaluation: row.evaluation,
          evaluationApprovalStatus: row.status === ProcessStatus.IN_PROGRESS
            ? ProcessStatus.IN_PROGRESS
            : null,
          approvalStatus: approval?.status ?? null,
          currentApproverName: this.formatProbationApprover(currentStep?.approver),
          confirmedDate: row.confirmedDate?.toISOString().slice(0, 10) ?? null,
          extensionCount: row.extensionCount,
          status: row.status,
          daysUntilPlannedEnd: Math.round((row.plannedEndDate.getTime() - today.getTime()) / 86_400_000),
          canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
          canManage,
          canRemindApproval: canManage
            && approval?.status === ProcessStatus.PENDING
            && Boolean(currentStep),
          canTransferApproval: canManage
            && approval?.status === ProcessStatus.PENDING
            && currentStep?.approverUserId === user.id,
        };
      }),
      meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    };
  }

  async findProbationApprovers(user: AuthenticatedUser): Promise<ProbationApproverOption[]> {
    if (!this.access.hasPermission(user, PERMISSIONS.EMPLOYEE_UPDATE)) {
      throw new ForbiddenException('当前账号没有维护试用流程的权限');
    }
    if (this.demo.enabled) return this.demo.getProbationApprovers();

    const users = await this.prisma.user.findMany({
      where: {
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        role: {
          permissions: {
            some: {
              permission: { code: PERMISSIONS.EMPLOYEE_UPDATE },
            },
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        employee: { select: { workEmail: true } },
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
    return users.map((candidate) => ({
      id: candidate.id,
      displayName: candidate.displayName,
      workEmail: candidate.employee?.workEmail ?? null,
    }));
  }

  async getProbationImportTemplate(format: 'XLSX' | 'CSV') {
    const headers = PROBATION_IMPORT_FIELDS.map(({ title }) => title);
    const extension = format === 'XLSX' ? 'xlsx' : 'csv';
    const filename = `试用管理导入模板.${extension}`;
    if (format === 'CSV') {
      return {
        buffer: Buffer.from(`﻿${headers.map((header) => `"${header}"`).join(',')}\r\n`, 'utf8'),
        filename,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('试用管理');
    worksheet.addRow(headers);
    worksheet.getRow(1).font = { bold: true };
    worksheet.columns.forEach((column, index) => {
      column.width = Math.min(28, Math.max(12, headers[index]?.length ?? 12));
    });
    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async importProbation(
    user: AuthenticatedUser,
    file: { originalname: string; buffer: Buffer } | undefined,
    auditContext: AuditContext,
  ): Promise<ProbationImportResult> {
    if (!file) throw new BadRequestException('请选择要导入的 XLSX 或 CSV 文件');
    if (this.demo.enabled) throw new ConflictException('试用管理导入仅支持数据库模式');

    const extension = file.originalname.split('.').pop()?.toLocaleLowerCase();
    if (extension !== 'xlsx' && extension !== 'csv') {
      throw new BadRequestException('仅支持 .xlsx 或 .csv 文件');
    }

    const workbook = new ExcelJS.Workbook();
    if (extension === 'xlsx') {
      try {
        await workbook.xlsx.load(file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      } catch {
        throw new BadRequestException('无法读取 XLSX 文件，请确认文件未损坏或受密码保护');
      }
    } else {
      const worksheet = workbook.addWorksheet('试用管理');
      this.parseProbationImportCsv(this.decodeProbationImportCsv(file.buffer))
        .forEach((row) => worksheet.addRow(row));
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('导入文件不包含工作表');
    if (worksheet.rowCount > 10_001) throw new BadRequestException('单次最多导入 10000 行');

    const columns = this.resolveProbationImportColumns(worksheet.getRow(1).values as unknown[]);
    const requiredColumns: Array<[ProbationImportFieldKey, string]> = [
      ['employeeNo', '工号'],
      ['startDate', '试用开始日期'],
      ['plannedEndDate', '预计试用结束日期'],
    ];
    const missingColumns = requiredColumns
      .filter(([field]) => !columns.has(field))
      .map(([, title]) => `“${title}”`);
    if (missingColumns.length > 0) {
      throw new BadRequestException(`导入文件必须包含${missingColumns.join('、')}列`);
    }

    const rows: ProbationImportRowResult[] = [];
    const seenEmployeeNos = new Set<string>();
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const input = this.readProbationImportRow(
        columns,
        worksheet.getRow(rowNumber).values as unknown[],
      );
      if (Object.values(input).every((value) => this.probationImportCellText(value) === '')) continue;

      const employeeNo = this.probationImportCellText(input.employeeNo).trim();
      if (!employeeNo) {
        rows.push({ rowNumber, employeeNo: null, action: 'FAILED', errors: ['工号不能为空'] });
        continue;
      }
      if (seenEmployeeNos.has(employeeNo)) {
        rows.push({ rowNumber, employeeNo, action: 'FAILED', errors: ['导入文件中的工号重复'] });
        continue;
      }
      seenEmployeeNos.add(employeeNo);

      try {
        const normalized = this.normalizeProbationImportInput(input, employeeNo);
        const target = await this.resolveProbationImportTarget(user, normalized);
        const action = await this.persistProbationImportRow(user, normalized, target, auditContext);
        rows.push({ rowNumber, employeeNo, action, errors: [] });
      } catch (error) {
        rows.push({
          rowNumber,
          employeeNo,
          action: 'FAILED',
          errors: [error instanceof Error ? error.message : '导入失败'],
        });
      }
    }

    return {
      created: rows.filter(({ action }) => action === 'CREATED').length,
      updated: rows.filter(({ action }) => action === 'UPDATED').length,
      skipped: rows.filter(({ action }) => action === 'SKIPPED').length,
      failed: rows.filter(({ action }) => action === 'FAILED').length,
      rows,
    };
  }

  async exportProbation(user: AuthenticatedUser, dto: ProbationExportDto) {
    const requestedIds = dto.probationIds ? [...new Set(dto.probationIds)] : [];
    const query: QueryProbationDto = {
      view: dto.query?.view ?? 'all',
      keyword: dto.query?.keyword,
      organizationId: dto.query?.organizationId,
      probationMonths: dto.query?.probationMonths,
      expiresWithinDays: dto.query?.expiresWithinDays,
      status: dto.query?.status,
      startDateFrom: dto.query?.startDateFrom,
      startDateTo: dto.query?.startDateTo,
      plannedEndDateFrom: dto.query?.plannedEndDateFrom,
      plannedEndDateTo: dto.query?.plannedEndDateTo,
      page: 1,
      pageSize: requestedIds.length || PROBATION_EXPORT_MAX_ROWS,
    };
    const result = await this.findProbation(user, query, requestedIds);
    if (result.meta.total > PROBATION_EXPORT_MAX_ROWS) {
      throw new BadRequestException(`当前筛选结果超过 ${PROBATION_EXPORT_MAX_ROWS} 条，请缩小筛选范围后再导出`);
    }
    const rows = result.data;
    if (requestedIds.length > 0) {
      if (result.meta.total !== requestedIds.length) {
        throw new BadRequestException('部分已选试用记录不在当前导出范围内，请刷新后重试');
      }
    }

    return createTableExport(
      rows.map((row) => ({ ...row, status: this.probationStatusLabel(row.status) })),
      dto.fields as ProbationExportFieldKey[],
      PROBATION_EXPORT_FIELDS,
      dto.format,
      '试用管理导出',
    );
  }

  async updateProbation(user: AuthenticatedUser, id: string, dto: UpdateProbationDto) {
    if (dto.startDate === undefined && dto.plannedEndDate === undefined) {
      throw new BadRequestException('请至少修改一个试用日期');
    }
    if (this.demo.enabled) return this.updateDemoProbation(user, id, dto);

    const record = await this.findManageableProbation(user, id);
    this.assertProbationEditable(record.status);

    const startDate = dto.startDate
      ? this.parseProbationDate(dto.startDate, '试用开始日期')
      : record.startDate;
    const plannedEndDate = dto.plannedEndDate
      ? this.parseProbationDate(dto.plannedEndDate, '预计试用结束日期')
      : record.plannedEndDate;
    if (plannedEndDate < startDate) {
      throw new BadRequestException('预计试用结束日期不得早于试用开始日期');
    }
    const isExtension = Boolean(dto.plannedEndDate && plannedEndDate > record.plannedEndDate);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.probationRecord.updateMany({
        where: { id: record.id, status: record.status, archivedAt: null },
        data: {
          ...(dto.startDate ? { startDate } : {}),
          ...(dto.plannedEndDate ? { plannedEndDate } : {}),
          ...(isExtension ? { extensionCount: { increment: 1 } } : {}),
        },
      });
      if (updated.count !== 1) throw new ConflictException('试用记录已被其他操作更新，请刷新后重试');
      await this.writeProbationAudit(user, AuditAction.UPDATE, record.id, {
        resource: 'probation-record',
        action: 'update-dates',
        startDate: startDate.toISOString().slice(0, 10),
        plannedEndDate: plannedEndDate.toISOString().slice(0, 10),
        isExtension,
      }, tx);
    });
    return { id: record.id };
  }

  async startProbationEvaluation(
    user: AuthenticatedUser,
    id: string,
    dto: StartProbationEvaluationDto = {},
  ) {
    if (this.demo.enabled) {
      return this.startDemoProbationEvaluation(user, id, dto.evaluationType ?? 'REGULARIZATION');
    }
    const record = await this.findManageableProbation(user, id);
    if (record.status !== ProcessStatus.DRAFT) {
      throw new ConflictException('仅待发起的试用记录可以发起考核');
    }
    const evaluationType = dto.evaluationType ?? 'REGULARIZATION';

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.probationRecord.updateMany({
        where: { id: record.id, status: ProcessStatus.DRAFT, archivedAt: null },
        data: { status: ProcessStatus.IN_PROGRESS, evaluationType },
      });
      if (updated.count !== 1) throw new ConflictException('试用记录已被其他操作更新，请刷新后重试');
      await this.writeProbationAudit(user, AuditAction.UPDATE, record.id, {
        resource: 'probation-record',
        action: 'start-evaluation',
        evaluationType,
      }, tx);
    });
    return { id: record.id };
  }

  async startProbationEvaluations(user: AuthenticatedUser, dto: StartProbationEvaluationsDto) {
    const probationIds = [...new Set(dto.probationIds)];
    const evaluationType = dto.evaluationType ?? 'REGULARIZATION';
    if (this.demo.enabled) {
      return this.startDemoProbationEvaluations(user, probationIds, evaluationType);
    }
    const employeeScope = this.access.hasAllEmployeeData(user)
      ? {}
      : await this.access.getEmployeeWhere(user);
    const records = await this.prisma.probationRecord.findMany({
      where: {
        id: { in: probationIds },
        archivedAt: null,
        employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE, ...employeeScope } },
      },
      select: { id: true, status: true },
    });
    if (records.length !== probationIds.length) {
      throw new NotFoundException('部分试用记录不存在或不在当前数据范围内');
    }
    if (records.some((record) => record.status !== ProcessStatus.DRAFT)) {
      throw new ConflictException('仅待发起的试用记录可以批量发起考核');
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.probationRecord.updateMany({
        where: { id: { in: probationIds }, status: ProcessStatus.DRAFT, archivedAt: null },
        data: { status: ProcessStatus.IN_PROGRESS, evaluationType },
      });
      if (updated.count !== probationIds.length) {
        throw new ConflictException('部分试用记录已被其他操作更新，请刷新后重试');
      }
      await this.writeProbationAudit(user, AuditAction.UPDATE, undefined, {
        resource: 'probation-record',
        action: 'batch-start-evaluation',
        probationIds,
        evaluationType,
      }, tx);
    });
    return { updated: probationIds.length };
  }

  async startProbationConfirmations(
    user: AuthenticatedUser,
    dto: StartProbationConfirmationsDto,
  ) {
    const probationIds = [...new Set(dto.probationIds)];
    if (this.demo.enabled) {
      return this.startDemoProbationConfirmations(user, probationIds, dto.approverUserId);
    }

    const employeeScope = this.access.hasAllEmployeeData(user)
      ? {}
      : await this.access.getEmployeeWhere(user);
    const records = await this.prisma.probationRecord.findMany({
      where: {
        id: { in: probationIds },
        archivedAt: null,
        employee: {
          is: {
            archivedAt: null,
            recordStatus: RecordStatus.ACTIVE,
            ...employeeScope,
          },
        },
      },
      select: {
        id: true,
        employeeId: true,
        status: true,
        employee: { select: { name: true } },
      },
    });
    if (records.length !== probationIds.length) {
      throw new NotFoundException('部分试用记录不存在或不在当前数据范围内');
    }
    if (records.some((record) => !PROBATION_CONFIRMATION_ELIGIBLE_STATUSES.includes(record.status))) {
      throw new ConflictException('仅待发起或考核中的试用记录可以发起转正申请');
    }
    await this.assertProbationApprover(
      dto.approverUserId,
      records.map((record) => record.employeeId),
    );

    await this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveProbationApprovals(tx, probationIds);
      const updated = await tx.probationRecord.updateMany({
        where: {
          id: { in: probationIds },
          status: { in: [ProcessStatus.DRAFT, ProcessStatus.IN_PROGRESS] },
          archivedAt: null,
        },
        data: {
          result: PROBATION_RESULT.RECOMMENDED_REGULAR,
          status: ProcessStatus.PENDING,
        },
      });
      if (updated.count !== probationIds.length) {
        throw new ConflictException('部分试用记录已被其他操作更新，请刷新后重试');
      }
      await Promise.all(records.map((record) => this.createProbationApprovalRequest(
        tx,
        user,
        record.id,
        record.employee.name,
        dto.approverUserId,
      )));
      await this.writeProbationAudit(user, AuditAction.UPDATE, undefined, {
        resource: 'probation-record',
        action: 'batch-start-confirmation',
        probationIds,
        approverUserId: dto.approverUserId,
      }, tx);
    });
    return { updated: probationIds.length };
  }

  async submitProbationConfirmation(
    user: AuthenticatedUser,
    id: string,
    dto: SubmitProbationConfirmationDto,
  ) {
    if (this.demo.enabled) return this.submitDemoProbationConfirmation(user, id, dto);
    const record = await this.findManageableProbation(user, id);
    if (record.status !== ProcessStatus.IN_PROGRESS) {
      throw new ConflictException('仅考核中的试用记录可以提交转正确认');
    }
    await this.assertProbationApprover(dto.approverUserId, [record.employeeId]);

    await this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveProbationApprovals(tx, [record.id]);
      const updated = await tx.probationRecord.updateMany({
        where: { id: record.id, status: ProcessStatus.IN_PROGRESS, archivedAt: null },
        data: {
          evaluation: dto.evaluation,
          result: PROBATION_RESULT.RECOMMENDED_REGULAR,
          status: ProcessStatus.PENDING,
        },
      });
      if (updated.count !== 1) throw new ConflictException('试用记录已被其他操作更新，请刷新后重试');
      await this.createProbationApprovalRequest(
        tx,
        user,
        record.id,
        record.employee.name,
        dto.approverUserId,
      );
      await this.writeProbationAudit(user, AuditAction.UPDATE, record.id, {
        resource: 'probation-record',
        action: 'submit-confirmation',
        approverUserId: dto.approverUserId,
      }, tx);
    });
    return { id: record.id };
  }

  async approveProbation(user: AuthenticatedUser, id: string) {
    if (this.demo.enabled) return this.approveDemoProbation(user, id);
    const record = await this.findManageableProbation(user, id);
    if (record.status !== ProcessStatus.PENDING) {
      throw new ConflictException('仅审批中的转正申请可以审批通过');
    }

    await this.prisma.$transaction(async (tx) => {
      const approval = await this.findCurrentProbationApproval(tx, record.id, ProcessStatus.PENDING);
      const currentStep = approval.steps.find((step) => step.stepOrder === approval.currentStep);
      if (!currentStep) throw new ConflictException('当前转正申请没有待处理的审批节点');
      if (currentStep.approverUserId !== user.id) {
        throw new ForbiddenException('仅当前审批人可以审批通过该转正申请');
      }
      const step = await tx.approvalStep.updateMany({
        where: { id: currentStep.id, decision: ApprovalDecision.PENDING },
        data: { decision: ApprovalDecision.APPROVED, operatedAt: new Date() },
      });
      if (step.count !== 1) throw new ConflictException('审批节点已被其他操作更新，请刷新后重试');
      const request = await tx.approvalRequest.updateMany({
        where: { id: approval.id, status: ProcessStatus.PENDING, archivedAt: null },
        data: { status: ProcessStatus.APPROVED, completedAt: new Date() },
      });
      if (request.count !== 1) throw new ConflictException('转正申请已被其他操作更新，请刷新后重试');
      const updated = await tx.probationRecord.updateMany({
        where: { id: record.id, status: ProcessStatus.PENDING, archivedAt: null },
        data: { status: ProcessStatus.APPROVED },
      });
      if (updated.count !== 1) throw new ConflictException('试用记录已被其他操作更新，请刷新后重试');
      await this.writeProbationAudit(user, AuditAction.UPDATE, record.id, {
        resource: 'probation-record',
        action: 'approve-confirmation',
        approvalRequestId: approval.id,
      }, tx);
    });
    return { id: record.id };
  }

  async remindProbationApproval(user: AuthenticatedUser, id: string) {
    if (this.demo.enabled) return this.remindDemoProbationApproval(user, id);
    const record = await this.findManageableProbation(user, id);
    if (record.status !== ProcessStatus.PENDING) {
      throw new ConflictException('仅审批中的转正申请可以催办');
    }
    const approval = await this.findCurrentProbationApproval(this.prisma, record.id, ProcessStatus.PENDING);
    const currentStep = approval.steps.find((step) => step.stepOrder === approval.currentStep);
    if (!currentStep) throw new ConflictException('当前转正申请没有待处理的审批节点');
    await this.writeProbationAudit(user, AuditAction.UPDATE, record.id, {
      resource: 'probation-record',
      action: 'remind-approval',
      approvalRequestId: approval.id,
      approverUserId: currentStep.approverUserId,
    }, this.prisma);
    return { id: record.id };
  }

  async transferProbationApproval(
    user: AuthenticatedUser,
    id: string,
    dto: TransferProbationApprovalDto,
  ) {
    if (this.demo.enabled) return this.transferDemoProbationApproval(user, id, dto.approverUserId);
    const record = await this.findManageableProbation(user, id);
    if (record.status !== ProcessStatus.PENDING) {
      throw new ConflictException('仅审批中的转正申请可以转交');
    }
    await this.assertProbationApprover(dto.approverUserId, [record.employeeId]);

    await this.prisma.$transaction(async (tx) => {
      const approval = await this.findCurrentProbationApproval(tx, record.id, ProcessStatus.PENDING);
      const currentStep = approval.steps.find((step) => step.stepOrder === approval.currentStep);
      if (!currentStep) throw new ConflictException('当前转正申请没有待处理的审批节点');
      if (currentStep.approverUserId !== user.id) {
        throw new ForbiddenException('仅当前审批人可以转交该转正申请');
      }
      if (currentStep.approverUserId === dto.approverUserId) {
        throw new BadRequestException('新的审批人与当前审批人相同');
      }
      const updated = await tx.approvalStep.updateMany({
        where: { id: currentStep.id, decision: ApprovalDecision.PENDING },
        data: { approverUserId: dto.approverUserId },
      });
      if (updated.count !== 1) throw new ConflictException('审批节点已被其他操作更新，请刷新后重试');
      await this.writeProbationAudit(user, AuditAction.UPDATE, record.id, {
        resource: 'probation-record',
        action: 'transfer-approval',
        approvalRequestId: approval.id,
        fromApproverUserId: currentStep.approverUserId,
        toApproverUserId: dto.approverUserId,
      }, tx);
    });
    return { id: record.id };
  }

  async confirmProbation(user: AuthenticatedUser, id: string, dto: ConfirmProbationDto) {
    if (this.demo.enabled) return this.confirmDemoProbation(user, id, dto);
    const record = await this.findManageableProbation(user, id);
    if (record.status !== ProcessStatus.APPROVED) {
      throw new ConflictException('仅审批通过的转正申请可以生效转正');
    }
    const confirmedDate = this.parseProbationDate(dto.confirmedDate, '转正日期');
    if (confirmedDate < record.startDate) {
      throw new BadRequestException('转正日期不得早于试用开始日期');
    }
    if (!record.employmentPeriodId) {
      throw new ConflictException('当前试用记录缺少任职周期，无法生效转正');
    }
    const employmentPeriodId = record.employmentPeriodId;

    await this.prisma.$transaction(async (tx) => {
      await this.findCurrentProbationApproval(tx, record.id, ProcessStatus.APPROVED);
      const updated = await tx.probationRecord.updateMany({
        where: { id: record.id, status: ProcessStatus.APPROVED, archivedAt: null },
        data: {
          actualEndDate: confirmedDate,
          confirmedDate,
          result: PROBATION_RESULT.CONFIRMED_REGULAR,
          status: ProcessStatus.COMPLETED,
        },
      });
      if (updated.count !== 1) throw new ConflictException('试用记录已被其他操作更新，请刷新后重试');

      const period = await tx.employmentPeriod.updateMany({
        where: {
          id: employmentPeriodId,
          employeeId: record.employeeId,
          employmentStatus: EmploymentStatus.PROBATION,
          status: RecordStatus.ACTIVE,
          archivedAt: null,
          actualExitDate: null,
        },
        data: { employmentStatus: EmploymentStatus.REGULAR },
      });
      if (period.count !== 1) {
        throw new ConflictException('当前任职周期已变更，无法完成转正');
      }
      await tx.employmentRecord.updateMany({
        where: {
          employeeId: record.employeeId,
          employmentPeriodId,
          currentFlag: true,
        },
        data: { currentFlag: false, endedAt: confirmedDate },
      });
      await tx.employmentRecord.create({
        data: {
          employeeId: record.employeeId,
          employmentPeriodId,
          status: EmploymentStatus.REGULAR,
          effectiveAt: confirmedDate,
          currentFlag: true,
        },
      });
      await tx.employeeAssignment.updateMany({
        where: {
          employeeId: record.employeeId,
          employmentPeriodId,
          status: AssignmentStatus.ACTIVE,
          archivedAt: null,
        },
        data: { confirmationDate: confirmedDate },
      });

      await this.writeProbationAudit(user, AuditAction.UPDATE, record.id, {
        resource: 'probation-record',
        action: 'confirm-regular',
        confirmedDate: confirmedDate.toISOString().slice(0, 10),
        employmentPeriodId,
      }, tx);
    });
    return { id: record.id };
  }

  async returnProbationToEvaluation(user: AuthenticatedUser, id: string) {
    if (this.demo.enabled) return this.returnDemoProbationToEvaluation(user, id);
    const record = await this.findManageableProbation(user, id);
    if (record.status !== ProcessStatus.PENDING) {
      throw new ConflictException('仅待确认的转正记录可以退回考核');
    }

    await this.prisma.$transaction(async (tx) => {
      const approval = await this.findCurrentProbationApproval(tx, record.id, ProcessStatus.PENDING);
      const currentStep = approval.steps.find((step) => step.stepOrder === approval.currentStep);
      if (!currentStep) throw new ConflictException('当前转正申请没有待处理的审批节点');
      if (currentStep.approverUserId !== user.id) {
        throw new ForbiddenException('仅当前审批人可以退回该转正申请');
      }
      const now = new Date();
      const step = await tx.approvalStep.updateMany({
        where: { id: currentStep.id, decision: ApprovalDecision.PENDING },
        data: { decision: ApprovalDecision.SKIPPED, operatedAt: now },
      });
      if (step.count !== 1) throw new ConflictException('审批节点已被其他操作更新，请刷新后重试');
      const request = await tx.approvalRequest.updateMany({
        where: { id: approval.id, status: ProcessStatus.PENDING, archivedAt: null },
        data: { status: ProcessStatus.WITHDRAWN, completedAt: now },
      });
      if (request.count !== 1) throw new ConflictException('转正申请已被其他操作更新，请刷新后重试');
      const updated = await tx.probationRecord.updateMany({
        where: { id: record.id, status: ProcessStatus.PENDING, archivedAt: null },
        data: { status: ProcessStatus.IN_PROGRESS, result: null },
      });
      if (updated.count !== 1) throw new ConflictException('试用记录已被其他操作更新，请刷新后重试');
      await this.writeProbationAudit(user, AuditAction.UPDATE, record.id, {
        resource: 'probation-record',
        action: 'return-to-evaluation',
        approvalRequestId: approval.id,
      }, tx);
    });
    return { id: record.id };
  }

  async findTrialPosts(
    user: AuthenticatedUser,
    query: QueryTrialPostDto,
  ): Promise<Paginated<TrialPostListItem>> {
    if (this.demo.enabled) return this.emptyTrialPostPage(query);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const conditions: Prisma.TrialPostRecordWhereInput[] = [
      { archivedAt: null },
      { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
    ];
    if (!hasAllEmployeeData) {
      conditions.push({
        targetPosition: {
          is: { organizationId: { in: accessibleOrganizationIds } },
        },
      });
    }

    if (query.view === 'active') {
      conditions.push({ status: ProcessStatus.DRAFT });
    } else if (query.view === 'evaluating') {
      conditions.push({ status: ProcessStatus.IN_PROGRESS });
    } else if (query.view === 'failed') {
      conditions.push({ result: '不通过' });
    } else if (query.view === 'passed') {
      conditions.push({ result: '通过' });
    }
    if (query.keyword) {
      conditions.push({
        employee: {
          is: {
            OR: [
              { employeeNo: { contains: query.keyword } },
              { name: { contains: query.keyword } },
            ],
          },
        },
      });
    }
    if (query.status) conditions.push({ status: query.status });
    if (query.startDateFrom || query.startDateTo) {
      conditions.push({
        startDate: {
          ...(query.startDateFrom ? { gte: new Date(query.startDateFrom) } : {}),
          ...(query.startDateTo ? { lte: new Date(query.startDateTo) } : {}),
        },
      });
    }
    if (query.endDateFrom || query.endDateTo) {
      conditions.push({
        endDate: {
          ...(query.endDateFrom ? { gte: new Date(query.endDateFrom) } : {}),
          ...(query.endDateTo ? { lte: new Date(query.endDateTo) } : {}),
        },
      });
    }

    const where: Prisma.TrialPostRecordWhereInput = { AND: conditions };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.trialPostRecord.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          startDate: true,
          endDate: true,
          result: true,
          status: true,
          employee: { select: { employeeNo: true, name: true } },
          targetPosition: {
            select: { organization: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.trialPostRecord.count({ where }),
    ]);

    const canDisplayOrganization = (organizationId: string | null) => (
      hasAllEmployeeData || (organizationId !== null && accessibleOrganizationIds.includes(organizationId))
    );
    const detailEmployeeIds = new Set<string>();
    if (hasAllEmployeeData) {
      rows.forEach((row) => detailEmployeeIds.add(row.employeeId));
    } else if (rows.length > 0) {
      const detailWhere = await this.access.getEmployeeWhere(
        user,
        accessibleOrganizationIds,
        new Date(),
      );
      const detailRows = await this.prisma.employee.findMany({
        where: {
          AND: [
            { id: { in: [...new Set(rows.map((row) => row.employeeId))] } },
            detailWhere,
          ],
        },
        select: { id: true },
      });
      detailRows.forEach(({ id }) => detailEmployeeIds.add(id));
    }
    return {
      data: rows.map((row) => presentTrialPost(row, {
        canDisplayOrganization,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findTerminations(
    user: AuthenticatedUser,
    query: QueryTerminationsDto,
  ): Promise<Paginated<TerminationListItem>> {
    if (this.demo.enabled) return this.emptyTerminationPage(query);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const conditions: Prisma.TerminationRecordWhereInput[] = [
      { archivedAt: null },
      { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
    ];
    if (!hasAllEmployeeData) {
      if (accessibleOrganizationIds.length === 0) return this.emptyTerminationPage(query);
      const visibleRows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT termination.id
        FROM termination_records AS termination
        WHERE termination.employment_period_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM employee_assignments AS assignment
            WHERE assignment.employee_id = termination.employee_id
              AND assignment.employment_period_id = termination.employment_period_id
              AND assignment.organization_id IN (${Prisma.join(accessibleOrganizationIds)})
              AND assignment.is_primary = TRUE
              AND assignment.status IN (${Prisma.join([
                AssignmentStatus.ACTIVE,
                AssignmentStatus.ENDED,
              ])})
              AND assignment.start_date <= COALESCE(termination.actual_last_working_date, termination.planned_last_working_date)
              AND (
                assignment.end_date IS NULL
                OR assignment.end_date >= COALESCE(termination.actual_last_working_date, termination.planned_last_working_date)
              )
          )
      `);
      if (visibleRows.length === 0) return this.emptyTerminationPage(query);
      conditions.push({ id: { in: visibleRows.map(({ id }) => id) } });
    }
    if (query.keyword) {
      conditions.push({
        employee: {
          is: {
            OR: [
              { employeeNo: { contains: query.keyword } },
              { name: { contains: query.keyword } },
            ],
          },
        },
      });
    }
    if (query.view === 'active') {
      conditions.push({ status: { in: [ProcessStatus.PENDING, ProcessStatus.IN_PROGRESS] } });
    } else if (query.view === 'completed') {
      conditions.push({ status: ProcessStatus.COMPLETED });
    }
    if (query.status) conditions.push({ status: query.status });
    const dateFilter = query.lastWorkingDateFrom || query.lastWorkingDateTo;
    if (dateFilter) {
      const dateConditions: Prisma.TerminationRecordWhereInput[] = [];
      const range = {
        ...(query.lastWorkingDateFrom ? { gte: new Date(query.lastWorkingDateFrom) } : {}),
        ...(query.lastWorkingDateTo ? { lte: new Date(query.lastWorkingDateTo) } : {}),
      };
      dateConditions.push({ actualLastWorkingDate: range });
      dateConditions.push({ actualLastWorkingDate: null, plannedLastWorkingDate: range });
      conditions.push({ OR: dateConditions });
    }

    const where: Prisma.TerminationRecordWhereInput = { AND: conditions };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.terminationRecord.findMany({
        where,
        include: {
          employee: { select: { employeeNo: true, name: true } },
          handoverCase: { select: { archivedAt: true, status: true } },
          approvalRequest: {
            select: {
              archivedAt: true,
              status: true,
              currentStep: true,
              steps: {
                where: { decision: ApprovalDecision.PENDING },
                orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }],
                select: { stepOrder: true, approver: { select: { displayName: true } } },
              },
            },
          },
        },
        orderBy: [{ plannedLastWorkingDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.terminationRecord.count({ where }),
    ]);

    const assignments = await Promise.all(rows.map((row) => {
      const effectiveDate = row.actualLastWorkingDate ?? row.plannedLastWorkingDate;
      return this.prisma.employeeAssignment.findFirst({
        where: {
          employeeId: row.employeeId,
          status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
          startDate: { lte: effectiveDate },
          OR: [{ endDate: null }, { endDate: { gte: effectiveDate } }],
          isPrimary: true,
          ...(row.employmentPeriodId ? { employmentPeriodId: row.employmentPeriodId } : {}),
          ...(hasAllEmployeeData ? {} : { organizationId: { in: accessibleOrganizationIds } }),
        },
        orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
        select: { organization: { select: { name: true } }, position: { select: { name: true } } },
      });
    }));

    const detailEmployeeIds = new Set<string>();
    if (hasAllEmployeeData) {
      rows.forEach((row) => detailEmployeeIds.add(row.employeeId));
    } else if (rows.length > 0) {
      const detailWhere = await this.access.getEmployeeWhere(
        user,
        accessibleOrganizationIds,
        new Date(),
      );
      const detailRows = await this.prisma.employee.findMany({
        where: {
          AND: [
            { id: { in: [...new Set(rows.map((row) => row.employeeId))] } },
            detailWhere,
          ],
        },
        select: { id: true },
      });
      detailRows.forEach(({ id }) => detailEmployeeIds.add(id));
    }

    return {
      data: rows.map((row, index) => presentTermination(row, {
        assignment: assignments[index] ? {
          organizationName: assignments[index].organization.name,
          positionName: assignments[index].position?.name ?? null,
        } : null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findRetirements(
    user: AuthenticatedUser,
    query: QueryRetirementsDto,
  ): Promise<Paginated<RetirementListItem>> {
    if (query.view === 'intention_application') {
      throw new ConflictException('意向退休日期申请视图暂不可用：尚未接入独立申请来源');
    }
    if (this.demo.enabled) return this.emptyRetirementPage(query);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const now = new Date();
    const conditions: Prisma.RetirementRecordWhereInput[] = [
      { archivedAt: null },
      { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
    ];

    const today = utcCalendarDay(now);
    if (query.view === 'upcoming') {
      const upcomingEnd = new Date(today);
      upcomingEnd.setUTCDate(upcomingEnd.getUTCDate() + 30);
      conditions.push({
        plannedRetirementDate: { gte: today, lte: upcomingEnd },
      });
      conditions.push({ actualRetirementDate: null });
      conditions.push({ status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.CANCELLED] } });
    } else if (query.view === 'in_progress') {
      conditions.push({ status: { in: [ProcessStatus.PENDING, ProcessStatus.IN_PROGRESS] } });
      conditions.push({ actualRetirementDate: null });
    } else if (query.view === 'overdue') {
      conditions.push({ plannedRetirementDate: { lt: today } });
      conditions.push({ actualRetirementDate: null });
      conditions.push({ status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.CANCELLED] } });
    } else if (query.view === 'completed') {
      conditions.push({ status: ProcessStatus.COMPLETED });
    }
    if (query.keyword) {
      conditions.push({
        employee: {
          is: {
            OR: [
              { employeeNo: { contains: query.keyword } },
              { name: { contains: query.keyword } },
            ],
          },
        },
      });
    }
    if (query.status) conditions.push({ status: query.status });
    if (query.plannedRetirementDateFrom || query.plannedRetirementDateTo) {
      conditions.push({
        plannedRetirementDate: {
          ...(query.plannedRetirementDateFrom ? { gte: new Date(query.plannedRetirementDateFrom) } : {}),
          ...(query.plannedRetirementDateTo ? { lte: new Date(query.plannedRetirementDateTo) } : {}),
        },
      });
    }

    const selectedOrganizationIds = query.departmentId
      ? await this.access.getOrganizationSubtreeIds(
          query.departmentId,
          hasAllEmployeeData ? undefined : accessibleOrganizationIds,
        )
      : undefined;
    if (selectedOrganizationIds && selectedOrganizationIds.length === 0) {
      return this.emptyRetirementPage(query);
    }
    const displayedOrganizationIds = selectedOrganizationIds
      ?? (hasAllEmployeeData ? undefined : accessibleOrganizationIds);
    if (displayedOrganizationIds && displayedOrganizationIds.length === 0) {
      return this.emptyRetirementPage(query);
    }
    if (displayedOrganizationIds) {
      const matchingRecords = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT rr.id
        FROM retirement_records AS rr
        WHERE rr.employment_period_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM employee_assignments AS assignment
            WHERE assignment.employee_id = rr.employee_id
              AND assignment.employment_period_id = rr.employment_period_id
              AND assignment.organization_id IN (${Prisma.join(displayedOrganizationIds)})
              AND assignment.is_primary = TRUE
              AND assignment.status IN (${Prisma.join([
                AssignmentStatus.ACTIVE,
                AssignmentStatus.ENDED,
              ])})
              AND assignment.start_date <= COALESCE(rr.actual_retirement_date, rr.planned_retirement_date)
              AND (
                assignment.end_date IS NULL
                OR assignment.end_date >= COALESCE(rr.actual_retirement_date, rr.planned_retirement_date)
              )
          )
      `);
      if (matchingRecords.length === 0) return this.emptyRetirementPage(query);
      conditions.push({ id: { in: matchingRecords.map(({ id }) => id) } });
    }

    const where: Prisma.RetirementRecordWhereInput = { AND: conditions };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.retirementRecord.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          employmentPeriodId: true,
          plannedRetirementDate: true,
          actualRetirementDate: true,
          employee: { select: { employeeNo: true, name: true, gender: true, birthDate: true } },
        },
        orderBy: [{ plannedRetirementDate: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.retirementRecord.count({ where }),
    ]);

    const detailEmployeeIds = new Set<string>();
    if (hasAllEmployeeData) {
      rows.forEach((row) => detailEmployeeIds.add(row.employeeId));
    } else if (rows.length > 0) {
      const detailWhere = await this.access.getEmployeeWhere(user, accessibleOrganizationIds, now);
      const detailRows = await this.prisma.employee.findMany({
        where: {
          AND: [
            { id: { in: [...new Set(rows.map((row) => row.employeeId))] } },
            detailWhere,
          ],
        },
        select: { id: true },
      });
      detailRows.forEach(({ id }) => detailEmployeeIds.add(id));
    }

    const assignments = await Promise.all(rows.map((row) => {
      const retirementDate = row.actualRetirementDate ?? row.plannedRetirementDate;
      return row.employmentPeriodId
        ? this.prisma.employeeAssignment.findFirst({
          where: {
            employeeId: row.employeeId,
            employmentPeriodId: row.employmentPeriodId,
            status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
            isPrimary: true,
            startDate: { lte: retirementDate },
            OR: [{ endDate: null }, { endDate: { gte: retirementDate } }],
            ...(displayedOrganizationIds ? { organizationId: { in: displayedOrganizationIds } } : {}),
          },
          orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
          select: { organization: { select: { name: true } }, jobTitle: { select: { name: true } } },
        })
        : Promise.resolve(null);
    }));
    return {
      data: rows.map((row, index) => presentRetirement(row, {
        assignment: assignments[index]
          ? {
              organizationName: assignments[index].organization.name,
              jobTitleName: assignments[index].jobTitle?.name ?? null,
            }
          : null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      }, now)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findMovements(
    user: AuthenticatedUser,
    query: QueryEmployeeMovementsDto,
  ): Promise<Paginated<EmployeeMovementListItem>> {
    if (this.demo.enabled) return this.emptyMovementPage(query);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const now = new Date();
    const conditions: Prisma.EmployeeMovementWhereInput[] = [
      { archivedAt: null },
      { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
    ];
    if (!hasAllEmployeeData) {
      if (accessibleOrganizationIds.length === 0) return this.emptyMovementPage(query);
      const visibleRows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT movement.id
        FROM employee_movements AS movement
        WHERE EXISTS (
          SELECT 1
          FROM employee_assignments AS assignment
          WHERE assignment.employee_id = movement.employee_id
            AND assignment.organization_id IN (${Prisma.join(accessibleOrganizationIds)})
            AND assignment.status IN (${Prisma.join([
              AssignmentStatus.ACTIVE,
              AssignmentStatus.ENDED,
            ])})
            AND assignment.start_date <= movement.effective_date
            AND (assignment.end_date IS NULL OR assignment.end_date >= movement.effective_date)
            AND (
              (movement.from_organization_id IS NULL AND movement.to_organization_id IS NULL)
              OR assignment.organization_id = movement.from_organization_id
              OR assignment.organization_id = movement.to_organization_id
            )
        )
      `);
      if (visibleRows.length === 0) return this.emptyMovementPage(query);
      conditions.push({ id: { in: visibleRows.map(({ id }) => id) } });
    }
    if (query.view === 'active') {
      conditions.push({ status: { in: [ProcessStatus.PENDING, ProcessStatus.IN_PROGRESS] } });
    } else if (query.view === 'completed') {
      conditions.push({ status: ProcessStatus.COMPLETED });
    }

    if (query.keyword) {
      conditions.push({
        employee: {
          is: {
            OR: [
              { employeeNo: { contains: query.keyword } },
              { name: { contains: query.keyword } },
            ],
          },
        },
      });
    }
    if (query.approvalStatus) {
      conditions.push({
        approvalRequestId: { not: null },
        approvalRequest: {
          is: {
            archivedAt: null,
            status: query.approvalStatus,
          },
        },
      });
    }
    if (query.effectiveDateFrom || query.effectiveDateTo) {
      conditions.push({
        effectiveDate: {
          ...(query.effectiveDateFrom ? { gte: new Date(query.effectiveDateFrom) } : {}),
          ...(query.effectiveDateTo ? { lte: new Date(query.effectiveDateTo) } : {}),
        },
      });
    }

    const where: Prisma.EmployeeMovementWhereInput = { AND: conditions };
    const include = Prisma.validator<Prisma.EmployeeMovementInclude>()({
      employee: { select: { employeeNo: true, name: true } },
      movementType: { select: { name: true } },
      fromOrganization: { select: { id: true, name: true } },
      toOrganization: { select: { id: true, name: true } },
      fromPosition: { select: { name: true, organizationId: true } },
      toPosition: { select: { name: true, organizationId: true } },
      approvalRequest: {
        include: {
          steps: {
            where: { decision: ApprovalDecision.PENDING },
            orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }],
            include: { approver: { select: { displayName: true } } },
          },
        },
      },
    });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeMovement.findMany({
        where,
        include,
        orderBy: [{ effectiveDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeMovement.count({ where }),
    ]);
    const canDisplayOrganization = (organizationId: string | null) => (
      hasAllEmployeeData || (organizationId !== null && accessibleOrganizationIds.includes(organizationId))
    );
    const detailEmployeeIds = new Set<string>();
    if (hasAllEmployeeData) {
      rows.forEach((row) => detailEmployeeIds.add(row.employeeId));
    } else if (rows.length > 0) {
      const detailWhere = await this.access.getEmployeeWhere(user, accessibleOrganizationIds, now);
      const detailRows = await this.prisma.employee.findMany({
        where: {
          AND: [
            { id: { in: [...new Set(rows.map((row) => row.employeeId))] } },
            detailWhere,
          ],
        },
        select: { id: true },
      });
      detailRows.forEach(({ id }) => detailEmployeeIds.add(id));
    }

    return {
      data: rows.map((row) => {
        const approvalRequest = row.approvalRequest?.archivedAt ? null : row.approvalRequest;
        const currentStep = approvalRequest && ACTIVE_APPROVAL_STATUSES.includes(approvalRequest.status)
          ? approvalRequest.steps.find((step) => step.stepOrder === approvalRequest.currentStep)
          : undefined;
        const canDisplayFrom = canDisplayOrganization(row.fromOrganizationId);
        const canDisplayTo = canDisplayOrganization(row.toOrganizationId);

        return {
          id: row.id,
          employeeId: row.employeeId,
          employeeNo: row.employee.employeeNo,
          employeeName: row.employee.name ?? '--',
          effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
          movementTypeName: row.movementType.name,
          movementTypeEmployeeName: null,
          movementStatus: row.status,
          approvalStatus: approvalRequest?.status ?? null,
          fromDepartmentName: canDisplayFrom ? row.fromOrganization?.name ?? null : null,
          fromPositionName: canDisplayFrom && (!row.fromPosition?.organizationId || row.fromPosition.organizationId === row.fromOrganizationId)
            ? row.fromPosition?.name ?? null
            : null,
          fromJobLevel: canDisplayFrom ? row.fromJobLevel ?? null : null,
          toDepartmentName: canDisplayTo ? row.toOrganization?.name ?? null : null,
          toPositionName: canDisplayTo && (!row.toPosition?.organizationId || row.toPosition.organizationId === row.toOrganizationId)
            ? row.toPosition?.name ?? null
            : null,
          toJobLevel: canDisplayTo ? row.toJobLevel ?? null : null,
          toWorkplaceName: null,
          handoverStatus: null,
          currentApproverName: currentStep?.approver.displayName ?? null,
          trialPostEndDate: null,
          canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
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

  private async findDemoProbation(
    user: AuthenticatedUser,
    query: QueryProbationDto,
    selectedProbationIds: readonly string[] = [],
  ): Promise<Paginated<ProbationListItem>> {
    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? undefined
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    let displayedOrganizationIds = accessibleOrganizationIds;
    if (query.organizationId) {
      displayedOrganizationIds = await this.access.getOrganizationSubtreeIds(
        query.organizationId,
        accessibleOrganizationIds,
      );
      if (displayedOrganizationIds.length === 0) return this.emptyPage(query);
    }

    const today = utcCalendarDay();
    const expiryDate = new Date(today);
    expiryDate.setUTCDate(expiryDate.getUTCDate() + (query.expiresWithinDays ?? 30));
    const selectedProbationIdSet = new Set(selectedProbationIds);
    const records = this.demo.getProbationRecords()
      .filter((record) => {
        if (selectedProbationIdSet.size > 0 && !selectedProbationIdSet.has(record.id)) {
          return false;
        }
        const employee = this.demo.getEmployee(record.employeeId);
        if (!employee) return false;
        if (displayedOrganizationIds && !displayedOrganizationIds.includes(record.organizationId)) {
          return false;
        }
        if (query.keyword && ![
          employee.employeeNo,
          employee.name,
        ].some((value) => value.includes(query.keyword!))) {
          return false;
        }
        if (query.probationMonths !== undefined && record.probationMonths !== query.probationMonths) {
          return false;
        }
        if (query.startDateFrom && record.startDate < this.parseProbationDate(query.startDateFrom, '试用开始日期')) {
          return false;
        }
        if (query.startDateTo && record.startDate > this.parseProbationDate(query.startDateTo, '试用开始日期')) {
          return false;
        }
        if (query.plannedEndDateFrom && record.plannedEndDate < this.parseProbationDate(query.plannedEndDateFrom, '预计试用结束日期')) {
          return false;
        }
        if (query.plannedEndDateTo && record.plannedEndDate > this.parseProbationDate(query.plannedEndDateTo, '预计试用结束日期')) {
          return false;
        }
        if (query.status && record.status !== query.status) return false;

        const isCurrentlyOnProbation = employee.employmentRecords.some(
          ({ status }) => status === EmploymentStatus.PROBATION,
        );
        if (query.view !== 'completed' && !isCurrentlyOnProbation) return false;
        if (query.view === 'expiring') {
          return record.status === ProcessStatus.DRAFT
            && record.plannedEndDate >= today
            && record.plannedEndDate <= expiryDate;
        }
        if (query.view === 'reviewing') return record.status === ProcessStatus.IN_PROGRESS;
        if (query.view === 'approval') return record.status === ProcessStatus.PENDING;
        if (query.view === 'completed') return record.status === ProcessStatus.COMPLETED;
        return OPEN_PROBATION_STATUSES.includes(record.status);
      })
      .sort((left, right) => (
        left.plannedEndDate.getTime() - right.plannedEndDate.getTime()
        || left.id.localeCompare(right.id)
      ));
    const pageRows = records.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);

    return {
      data: pageRows.map((record) => {
        const employee = this.demo.getEmployee(record.employeeId)!;
        const approver = record.approval?.status === ProcessStatus.PENDING
          ? this.demo.getProbationApprover(record.approval.approverUserId)
          : null;
        const canViewEmployeeDetail = hasAllEmployeeData
          || this.access.canAccessOrganization(user, record.organizationId);
        const canManage = canViewEmployeeDetail
          && this.access.hasPermission(user, PERMISSIONS.EMPLOYEE_UPDATE);
        return {
          id: record.id,
          employeeId: record.employeeId,
          employeeNo: employee.employeeNo,
          employeeName: employee.name,
          organizationName: null,
          departmentName: employee.organization.name,
          positionName: record.positionName,
          jobTitleName: record.jobTitleName,
          startDate: record.startDate.toISOString().slice(0, 10),
          plannedEndDate: record.plannedEndDate.toISOString().slice(0, 10),
          probationMonths: record.probationMonths,
          actualEndDate: record.actualEndDate?.toISOString().slice(0, 10) ?? null,
          evaluationType: record.evaluationType,
          evaluationName: this.probationEvaluationName(record.evaluationType),
          result: record.result,
          evaluation: record.evaluation,
          evaluationApprovalStatus: record.status === ProcessStatus.IN_PROGRESS
            ? ProcessStatus.IN_PROGRESS
            : null,
          approvalStatus: record.approval?.status ?? null,
          currentApproverName: this.formatProbationApprover(approver),
          confirmedDate: record.confirmedDate?.toISOString().slice(0, 10) ?? null,
          extensionCount: record.extensionCount,
          status: record.status,
          daysUntilPlannedEnd: Math.round(
            (record.plannedEndDate.getTime() - today.getTime()) / 86_400_000,
          ),
          canViewEmployeeDetail,
          canManage,
          canRemindApproval: canManage && record.approval?.status === ProcessStatus.PENDING,
          canTransferApproval: canManage
            && record.approval?.status === ProcessStatus.PENDING
            && record.approval?.approverUserId === user.id,
        };
      }),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: records.length,
        totalPages: Math.ceil(records.length / query.pageSize),
      },
    };
  }

  private async updateDemoProbation(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateProbationDto,
  ) {
    const record = await this.findManageableDemoProbation(user, id);
    this.assertProbationEditable(record.status);
    const startDate = dto.startDate
      ? this.parseProbationDate(dto.startDate, '试用开始日期')
      : record.startDate;
    const plannedEndDate = dto.plannedEndDate
      ? this.parseProbationDate(dto.plannedEndDate, '预计试用结束日期')
      : record.plannedEndDate;
    if (plannedEndDate < startDate) {
      throw new BadRequestException('预计试用结束日期不得早于试用开始日期');
    }
    const isExtension = Boolean(
      dto.plannedEndDate && plannedEndDate.getTime() > record.plannedEndDate.getTime(),
    );
    record.startDate = startDate;
    record.plannedEndDate = plannedEndDate;
    if (isExtension) record.extensionCount += 1;
    record.updatedAt = new Date();
    await this.writeDemoProbationAudit(user, AuditAction.UPDATE, record.id, {
      resource: 'probation-record',
      action: 'update-dates',
      startDate: startDate.toISOString().slice(0, 10),
      plannedEndDate: plannedEndDate.toISOString().slice(0, 10),
      isExtension,
    });
    return { id: record.id };
  }

  private async startDemoProbationEvaluation(
    user: AuthenticatedUser,
    id: string,
    evaluationType: ProbationEvaluationType,
  ) {
    const record = await this.findManageableDemoProbation(user, id);
    if (record.status !== ProcessStatus.DRAFT) {
      throw new ConflictException('仅待发起的试用记录可以发起考核');
    }
    record.status = ProcessStatus.IN_PROGRESS;
    record.evaluationType = evaluationType;
    record.updatedAt = new Date();
    await this.writeDemoProbationAudit(user, AuditAction.UPDATE, record.id, {
      resource: 'probation-record',
      action: 'start-evaluation',
      evaluationType,
    });
    return { id: record.id };
  }

  private async startDemoProbationEvaluations(
    user: AuthenticatedUser,
    probationIds: string[],
    evaluationType: ProbationEvaluationType,
  ) {
    if (probationIds.length === 0) throw new BadRequestException('请至少选择一条试用记录');
    const records = await Promise.all(
      probationIds.map((id) => this.findManageableDemoProbation(user, id)),
    );
    if (records.some((record) => record.status !== ProcessStatus.DRAFT)) {
      throw new ConflictException('仅待发起的试用记录可以批量发起考核');
    }
    const now = new Date();
    records.forEach((record) => {
      record.status = ProcessStatus.IN_PROGRESS;
      record.evaluationType = evaluationType;
      record.updatedAt = now;
    });
    await this.writeDemoProbationAudit(user, AuditAction.UPDATE, undefined, {
      resource: 'probation-record',
      action: 'batch-start-evaluation',
      probationIds,
      evaluationType,
    });
    return { updated: records.length };
  }

  private async startDemoProbationConfirmations(
    user: AuthenticatedUser,
    probationIds: string[],
    approverUserId: string,
  ) {
    if (probationIds.length === 0) throw new BadRequestException('请至少选择一条试用记录');
    this.assertDemoProbationApprover(approverUserId);
    const records = await Promise.all(
      probationIds.map((id) => this.findManageableDemoProbation(user, id)),
    );
    if (records.some((record) => !PROBATION_CONFIRMATION_ELIGIBLE_STATUSES.includes(record.status))) {
      throw new ConflictException('仅待发起或考核中的试用记录可以发起转正申请');
    }
    const now = new Date();
    records.forEach((record) => {
      record.status = ProcessStatus.PENDING;
      record.result = PROBATION_RESULT.RECOMMENDED_REGULAR;
      record.approval = {
        status: ProcessStatus.PENDING,
        approverUserId,
        submittedAt: now,
      };
      record.updatedAt = now;
    });
    await this.writeDemoProbationAudit(user, AuditAction.UPDATE, undefined, {
      resource: 'probation-record',
      action: 'batch-start-confirmation',
      probationIds,
      approverUserId,
    });
    return { updated: records.length };
  }

  private async submitDemoProbationConfirmation(
    user: AuthenticatedUser,
    id: string,
    dto: SubmitProbationConfirmationDto,
  ) {
    const record = await this.findManageableDemoProbation(user, id);
    if (record.status !== ProcessStatus.IN_PROGRESS) {
      throw new ConflictException('仅考核中的试用记录可以提交转正确认');
    }
    if (!dto.evaluation.trim()) throw new BadRequestException('请填写考核评价');
    this.assertDemoProbationApprover(dto.approverUserId);
    const now = new Date();
    record.evaluation = dto.evaluation.trim();
    record.result = PROBATION_RESULT.RECOMMENDED_REGULAR;
    record.status = ProcessStatus.PENDING;
    record.approval = {
      status: ProcessStatus.PENDING,
      approverUserId: dto.approverUserId,
      submittedAt: now,
    };
    record.updatedAt = now;
    await this.writeDemoProbationAudit(user, AuditAction.UPDATE, record.id, {
      resource: 'probation-record',
      action: 'submit-confirmation',
      approverUserId: dto.approverUserId,
    });
    return { id: record.id };
  }

  private async approveDemoProbation(user: AuthenticatedUser, id: string) {
    const record = await this.findManageableDemoProbation(user, id);
    if (record.status !== ProcessStatus.PENDING || record.approval?.status !== ProcessStatus.PENDING) {
      throw new ConflictException('仅审批中的转正申请可以审批通过');
    }
    if (record.approval.approverUserId !== user.id) {
      throw new ForbiddenException('仅当前审批人可以审批通过该转正申请');
    }
    record.approval.status = ProcessStatus.APPROVED;
    record.status = ProcessStatus.APPROVED;
    record.updatedAt = new Date();
    await this.writeDemoProbationAudit(user, AuditAction.UPDATE, record.id, {
      resource: 'probation-record',
      action: 'approve-confirmation',
    });
    return { id: record.id };
  }

  private async remindDemoProbationApproval(user: AuthenticatedUser, id: string) {
    const record = await this.findManageableDemoProbation(user, id);
    if (record.status !== ProcessStatus.PENDING || record.approval?.status !== ProcessStatus.PENDING) {
      throw new ConflictException('仅审批中的转正申请可以催办');
    }
    record.approval.lastRemindedAt = new Date();
    record.updatedAt = new Date();
    await this.writeDemoProbationAudit(user, AuditAction.UPDATE, record.id, {
      resource: 'probation-record',
      action: 'remind-approval',
      approverUserId: record.approval.approverUserId,
    });
    return { id: record.id };
  }

  private async transferDemoProbationApproval(
    user: AuthenticatedUser,
    id: string,
    approverUserId: string,
  ) {
    const record = await this.findManageableDemoProbation(user, id);
    if (record.status !== ProcessStatus.PENDING || record.approval?.status !== ProcessStatus.PENDING) {
      throw new ConflictException('仅审批中的转正申请可以转交');
    }
    this.assertDemoProbationApprover(approverUserId);
    if (record.approval.approverUserId === approverUserId) {
      throw new BadRequestException('新的审批人与当前审批人相同');
    }
    if (record.approval.approverUserId !== user.id) {
      throw new ForbiddenException('仅当前审批人可以转交该转正申请');
    }
    const fromApproverUserId = record.approval.approverUserId;
    record.approval.approverUserId = approverUserId;
    record.updatedAt = new Date();
    await this.writeDemoProbationAudit(user, AuditAction.UPDATE, record.id, {
      resource: 'probation-record',
      action: 'transfer-approval',
      fromApproverUserId,
      toApproverUserId: approverUserId,
    });
    return { id: record.id };
  }

  private async confirmDemoProbation(
    user: AuthenticatedUser,
    id: string,
    dto: ConfirmProbationDto,
  ) {
    const record = await this.findManageableDemoProbation(user, id);
    if (record.status !== ProcessStatus.APPROVED || record.approval?.status !== ProcessStatus.APPROVED) {
      throw new ConflictException('仅审批通过的转正申请可以生效转正');
    }
    const confirmedDate = this.parseProbationDate(dto.confirmedDate, '转正日期');
    if (confirmedDate < record.startDate) {
      throw new BadRequestException('转正日期不得早于试用开始日期');
    }
    record.actualEndDate = confirmedDate;
    record.confirmedDate = confirmedDate;
    record.result = PROBATION_RESULT.CONFIRMED_REGULAR;
    record.status = ProcessStatus.COMPLETED;
    record.updatedAt = new Date();
    this.demo.setEmployeeEmploymentStatus(record.employeeId, EmploymentStatus.REGULAR);
    await this.writeDemoProbationAudit(user, AuditAction.UPDATE, record.id, {
      resource: 'probation-record',
      action: 'confirm-regular',
      confirmedDate: confirmedDate.toISOString().slice(0, 10),
    });
    return { id: record.id };
  }

  private async returnDemoProbationToEvaluation(user: AuthenticatedUser, id: string) {
    const record = await this.findManageableDemoProbation(user, id);
    if (record.status !== ProcessStatus.PENDING || record.approval?.status !== ProcessStatus.PENDING) {
      throw new ConflictException('仅待确认的转正记录可以退回考核');
    }
    if (record.approval.approverUserId !== user.id) {
      throw new ForbiddenException('仅当前审批人可以退回该转正申请');
    }
    record.approval.status = ProcessStatus.WITHDRAWN;
    record.status = ProcessStatus.IN_PROGRESS;
    record.result = null;
    record.updatedAt = new Date();
    await this.writeDemoProbationAudit(user, AuditAction.UPDATE, record.id, {
      resource: 'probation-record',
      action: 'return-to-evaluation',
    });
    return { id: record.id };
  }

  private async findManageableDemoProbation(user: AuthenticatedUser, id: string) {
    const record = this.demo.getProbationRecord(id);
    if (
      !record
      || !this.access.canAccessOrganization(user, record.organizationId)
    ) {
      throw new NotFoundException('试用记录不存在或不在当前数据范围内');
    }
    return record;
  }

  private assertDemoProbationApprover(approverUserId: string) {
    if (!this.demo.getProbationApprover(approverUserId)) {
      throw new BadRequestException('所选转正审批人不存在或没有员工维护权限');
    }
  }

  private async writeDemoProbationAudit(
    user: AuthenticatedUser,
    action: AuditAction,
    resourceId: string | undefined,
    metadata: Prisma.InputJsonValue,
  ) {
    await this.audit?.create(
      { userId: user.id },
      action,
      resourceId,
      metadata,
      this.prisma,
      'probation_record',
    );
  }

  private async assertProbationApprover(
    approverUserId: string,
    employeeIds: readonly string[] = [],
  ) {
    const approver = await this.prisma.user.findFirst({
      where: {
        id: approverUserId,
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        role: {
          permissions: {
            some: {
              permission: { code: PERMISSIONS.EMPLOYEE_UPDATE },
            },
          },
        },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: {
          select: {
            code: true,
            name: true,
            permissions: {
              select: {
                permission: { select: { code: true } },
              },
            },
          },
        },
        dataScopes: { select: { organizationId: true } },
      },
    });
    if (!approver) {
      throw new BadRequestException('所选转正审批人不存在或没有员工维护权限');
    }
    const distinctEmployeeIds = [...new Set(employeeIds)];
    if (distinctEmployeeIds.length === 0) return;

    const approverUser: AuthenticatedUser = {
      id: approver.id,
      username: approver.username,
      displayName: approver.displayName,
      role: approver.role.code as AuthenticatedUser['role'],
      roleName: approver.role.name,
      permissions: approver.role.permissions.map(
        ({ permission }) => permission.code,
      ) as AuthenticatedUser['permissions'],
      organizationIds: approver.dataScopes.map(({ organizationId }) => organizationId),
    };
    const employeeScope = this.access.hasAllEmployeeData(approverUser)
      ? {}
      : await this.access.getEmployeeWhere(approverUser);
    const accessibleEmployees = await this.prisma.employee.count({
      where: {
        id: { in: distinctEmployeeIds },
        archivedAt: null,
        recordStatus: RecordStatus.ACTIVE,
        ...employeeScope,
      },
    });
    if (accessibleEmployees !== distinctEmployeeIds.length) {
      throw new BadRequestException('所选转正审批人不具备全部相关员工的数据权限');
    }
  }

  private async assertNoActiveProbationApprovals(
    client: Pick<Prisma.TransactionClient, 'approvalRequest'>,
    probationIds: string[],
  ) {
    const approvals = await client.approvalRequest.findMany({
      where: {
        businessType: PROBATION_APPROVAL_BUSINESS_TYPE,
        businessId: { in: probationIds },
        archivedAt: null,
        status: { in: ACTIVE_APPROVAL_STATUSES },
      },
      select: { businessId: true },
    });
    if (approvals.length > 0) {
      throw new ConflictException('部分试用记录已有进行中的转正申请');
    }
  }

  private async createProbationApprovalRequest(
    client: Prisma.TransactionClient,
    user: AuthenticatedUser,
    probationId: string,
    employeeName: string | null,
    approverUserId: string,
  ) {
    const now = new Date();
    await client.approvalRequest.create({
      data: {
        businessType: PROBATION_APPROVAL_BUSINESS_TYPE,
        businessId: probationId,
        applicantUserId: user.id,
        title: `${employeeName ?? '员工'}转正申请`,
        currentStep: 1,
        status: ProcessStatus.PENDING,
        submittedAt: now,
        steps: {
          create: {
            stepOrder: 1,
            approverUserId,
          },
        },
      },
    });
  }

  private async findCurrentProbationApproval(
    client: Pick<Prisma.TransactionClient, 'approvalRequest'>,
    probationId: string,
    status: ProcessStatus,
  ) {
    const approval = await client.approvalRequest.findFirst({
      where: {
        businessType: PROBATION_APPROVAL_BUSINESS_TYPE,
        businessId: probationId,
        status,
        archivedAt: null,
      },
      select: {
        id: true,
        currentStep: true,
        steps: {
          where: { decision: ApprovalDecision.PENDING },
          select: {
            id: true,
            stepOrder: true,
            approverUserId: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    if (!approval) throw new ConflictException('未找到当前试用转正审批流程');
    return approval;
  }

  private probationOrganizationName(
    agreements: Array<{
      startDate: Date | null;
      endDate: Date | null;
      terminationDate: Date | null;
      employingCompany: { name: string } | null;
    }>,
    effectiveDate: Date,
  ) {
    const effectiveAgreement = agreements.find((agreement) => {
      const agreementEnd = agreement.terminationDate ?? agreement.endDate;
      return (!agreement.startDate || agreement.startDate <= effectiveDate)
        && (!agreementEnd || agreementEnd >= effectiveDate);
    });
    return effectiveAgreement?.employingCompany?.name
      ?? agreements.find((agreement) => agreement.employingCompany)?.employingCompany?.name
      ?? null;
  }

  private normalizeProbationEvaluationType(value: string | null): ProbationEvaluationType | null {
    return value === 'IN_PROBATION' || value === 'REGULARIZATION' ? value : null;
  }

  private probationEvaluationName(value: string | null) {
    const type = this.normalizeProbationEvaluationType(value);
    return type ? PROBATION_EVALUATION_NAMES[type] : null;
  }

  private formatProbationApprover(
    approver: { displayName: string; workEmail?: string | null; employee?: { workEmail: string | null } | null } | null | undefined,
  ) {
    if (!approver) return null;
    const workEmail = approver.workEmail ?? approver.employee?.workEmail ?? null;
    return workEmail ? `${approver.displayName}(${workEmail})` : approver.displayName;
  }

  private parseProbationDate(value: string, label: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${label}必须为 YYYY-MM-DD`);
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day!));
    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month! - 1
      || date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${label}不是有效日期`);
    }
    return date;
  }

  private assertProbationEditable(status: ProcessStatus) {
    if (!EDITABLE_PROBATION_STATUSES.includes(status)) {
      throw new ConflictException('当前试用记录不允许再编辑日期');
    }
  }

  private async findManageableProbation(user: AuthenticatedUser, id: string) {
    if (this.demo.enabled) throw new ConflictException('试用管理操作仅支持数据库模式');
    const employeeScope = this.access.hasAllEmployeeData(user)
      ? {}
      : await this.access.getEmployeeWhere(user);
    const record = await this.prisma.probationRecord.findFirst({
      where: {
        id,
        archivedAt: null,
        employee: {
          is: {
            archivedAt: null,
            recordStatus: RecordStatus.ACTIVE,
            ...employeeScope,
          },
        },
      },
      select: {
        id: true,
        employeeId: true,
        employmentPeriodId: true,
        startDate: true,
        plannedEndDate: true,
        status: true,
        employee: { select: { name: true } },
      },
    });
    if (!record) throw new NotFoundException('试用记录不存在或不在当前数据范围内');
    return record;
  }

  private async writeProbationAudit(
    user: AuthenticatedUser,
    action: AuditAction,
    resourceId: string | undefined,
    metadata: Prisma.InputJsonValue,
    client: Prisma.TransactionClient,
    auditContext?: AuditContext,
  ) {
    await this.audit?.create(
      auditContext ?? { userId: user.id },
      action,
      resourceId,
      metadata,
      client,
      'probation_record',
    );
  }

  private async persistProbationImportRow(
    user: AuthenticatedUser,
    input: ProbationImportInput,
    target: ProbationImportTarget,
    auditContext: AuditContext,
  ): Promise<ProbationImportAction> {
    return this.prisma.$transaction(async (tx) => {
      const records = await tx.probationRecord.findMany({
        where: {
          employeeId: target.employeeId,
          employmentPeriodId: target.employmentPeriodId,
          archivedAt: null,
        },
        select: {
          id: true,
          startDate: true,
          plannedEndDate: true,
          status: true,
        },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      });
      const updateRecord = async (record: typeof records[number]) => {
        const extended = input.plannedEndDate > record.plannedEndDate;
        const updated = await tx.probationRecord.updateMany({
          where: {
            id: record.id,
            status: { in: [ProcessStatus.DRAFT, ProcessStatus.IN_PROGRESS] },
            archivedAt: null,
          },
          data: {
            startDate: input.startDate,
            plannedEndDate: input.plannedEndDate,
            ...(input.probationMonths !== undefined ? { probationMonths: input.probationMonths } : {}),
            ...(extended ? { extensionCount: { increment: 1 } } : {}),
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('试用记录已被其他操作更新，请刷新后重试');
        }
        await this.writeProbationAudit(user, AuditAction.UPDATE, record.id, {
          resource: 'probation-record',
          action: 'import-update',
          employeeNo: input.employeeNo,
          startDate: input.startDate.toISOString().slice(0, 10),
          plannedEndDate: input.plannedEndDate.toISOString().slice(0, 10),
          ...(input.probationMonths !== undefined ? { probationMonths: input.probationMonths } : {}),
        }, tx, auditContext);
      };

      const matchingStartRecord = records.find(({ startDate }) => (
        this.sameCalendarDate(startDate, input.startDate)
      ));
      if (matchingStartRecord) {
        if (
          matchingStartRecord.status !== ProcessStatus.DRAFT
          && matchingStartRecord.status !== ProcessStatus.IN_PROGRESS
        ) {
          throw new ConflictException('该试用记录已进入转正确认或已完成，不能通过导入修改');
        }
        await updateRecord(matchingStartRecord);
        return 'UPDATED';
      }

      const inProgressRecords = records.filter(({ status }) => (
        status === ProcessStatus.DRAFT || status === ProcessStatus.IN_PROGRESS
      ));
      if (inProgressRecords.length === 1) {
        await updateRecord(inProgressRecords[0]!);
        return 'UPDATED';
      }
      if (inProgressRecords.length > 1) {
        throw new ConflictException('该员工当前任职周期存在多条未完成试用记录，请先在页面中处理');
      }
      if (records.some(({ status }) => status === ProcessStatus.PENDING)) {
        throw new ConflictException('该员工的试用记录已进入转正确认，不能通过导入新增');
      }

      const created = await tx.probationRecord.create({
        data: {
          employeeId: target.employeeId,
          employmentPeriodId: target.employmentPeriodId,
          startDate: input.startDate,
          plannedEndDate: input.plannedEndDate,
          probationMonths: input.probationMonths,
          status: ProcessStatus.DRAFT,
        },
        select: { id: true },
      });
      await this.writeProbationAudit(user, AuditAction.CREATE, created.id, {
        resource: 'probation-record',
        action: 'import-create',
        employeeNo: input.employeeNo,
        startDate: input.startDate.toISOString().slice(0, 10),
        plannedEndDate: input.plannedEndDate.toISOString().slice(0, 10),
        ...(input.probationMonths !== undefined ? { probationMonths: input.probationMonths } : {}),
      }, tx, auditContext);
      return 'CREATED';
    });
  }

  private async resolveProbationImportTarget(
    user: AuthenticatedUser,
    input: ProbationImportInput,
  ): Promise<ProbationImportTarget> {
    const accessibleOrganizationIds = this.access.hasAllEmployeeData(user)
      ? undefined
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    if (accessibleOrganizationIds?.length === 0) {
      throw new NotFoundException('当前账号没有可导入试用记录的数据范围');
    }

    const assignment = await this.prisma.employeeAssignment.findFirst({
      where: {
        employee: {
          is: {
            employeeNo: input.employeeNo,
            archivedAt: null,
            recordStatus: RecordStatus.ACTIVE,
          },
        },
        employmentPeriodId: { not: null },
        employmentPeriod: {
          is: {
            status: RecordStatus.ACTIVE,
            archivedAt: null,
            actualExitDate: null,
            entryDate: { lte: input.startDate },
            employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
            employmentStatus: EmploymentStatus.PROBATION,
          },
        },
        status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
        archivedAt: null,
        startDate: { lte: input.startDate },
        OR: [{ endDate: null }, { endDate: { gte: input.startDate } }],
        ...(accessibleOrganizationIds ? { organizationId: { in: accessibleOrganizationIds } } : {}),
      },
      select: {
        employeeId: true,
        employmentPeriodId: true,
        employee: { select: { name: true } },
        organization: { select: { name: true } },
        position: { select: { name: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
    });
    if (!assignment?.employmentPeriodId) {
      throw new NotFoundException('未找到当前数据范围内与试用开始日期匹配的员工任职记录');
    }

    this.assertProbationImportMatch('姓名', input.employeeName, assignment.employee.name);
    this.assertProbationImportMatch('部门', input.departmentName, assignment.organization.name);
    this.assertProbationImportMatch('职位', input.positionName, assignment.position?.name ?? null);
    return {
      employeeId: assignment.employeeId,
      employmentPeriodId: assignment.employmentPeriodId,
      employeeName: assignment.employee.name,
      departmentName: assignment.organization.name,
      positionName: assignment.position?.name ?? null,
    };
  }

  private normalizeProbationImportInput(
    values: Partial<Record<ProbationImportFieldKey, unknown>>,
    employeeNo: string,
  ): ProbationImportInput {
    const startDate = this.normalizeProbationImportDate(values.startDate, '试用开始日期');
    const plannedEndDate = this.normalizeProbationImportDate(values.plannedEndDate, '预计试用结束日期');
    if (plannedEndDate < startDate) {
      throw new BadRequestException('预计试用结束日期不得早于试用开始日期');
    }
    return {
      employeeNo,
      employeeName: this.optionalProbationImportText(values.employeeName),
      departmentName: this.optionalProbationImportText(values.departmentName),
      positionName: this.optionalProbationImportText(values.positionName),
      startDate,
      plannedEndDate,
      probationMonths: this.normalizeProbationImportMonths(values.probationMonths),
    };
  }

  private assertProbationImportMatch(
    label: string,
    importedValue: string | undefined,
    expectedValue: string | null,
  ) {
    if (!importedValue) return;
    if (
      !expectedValue
      || this.normalizeProbationImportMatchText(importedValue)
        !== this.normalizeProbationImportMatchText(expectedValue)
    ) {
      throw new BadRequestException(`${label}“${importedValue}”与员工在试用开始日期的任职信息不一致`);
    }
  }

  private normalizeProbationImportMonths(value: unknown) {
    const normalized = this.optionalProbationImportText(value);
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) {
      throw new BadRequestException('试用期(月)必须是 1 到 24 的整数');
    }
    return parsed;
  }

  private normalizeProbationImportDate(value: unknown, label: string) {
    const resolved = this.unwrapProbationImportCellValue(value);
    if (resolved instanceof Date) return this.toProbationCalendarDate(resolved, label);
    if (typeof resolved === 'number') {
      if (!Number.isFinite(resolved)) throw new BadRequestException(`${label}不是有效日期`);
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(resolved) * 86_400_000);
      return this.toProbationCalendarDate(date, label);
    }

    const normalized = this.probationImportCellText(resolved).replace(/[/.]/g, '-');
    if (!normalized) throw new BadRequestException(`${label}不能为空`);
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
      throw new BadRequestException(`${label}必须为 YYYY-MM-DD、YYYY/MM/DD、YYYY.MM.DD 或 Excel 日期`);
    }
    const [year, month, day] = normalized.split('-').map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day!));
    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month! - 1
      || date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${label}不是有效日期`);
    }
    return this.toProbationCalendarDate(date, label);
  }

  private toProbationCalendarDate(value: Date, label: string) {
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth();
    const day = value.getUTCDate();
    if (year < 1900 || year > 2100) throw new BadRequestException(`${label}超出支持范围`);
    return new Date(Date.UTC(year, month, day));
  }

  private resolveProbationImportColumns(values: unknown[]) {
    const columns = new Map<ProbationImportFieldKey, number>();
    values.forEach((value, index) => {
      const field = this.resolveProbationImportHeader(this.probationImportCellText(value));
      if (field && !columns.has(field)) columns.set(field, index);
    });
    return columns;
  }

  private resolveProbationImportHeader(value: string): ProbationImportFieldKey | undefined {
    const normalized = this.normalizeProbationImportHeader(value);
    const standardField = PROBATION_IMPORT_FIELDS.find(({ title }) => (
      this.normalizeProbationImportHeader(title) === normalized
    ));
    if (standardField) return standardField.key;

    const aliases: Record<string, ProbationImportFieldKey> = {
      jobnumber: 'employeeNo',
      parent_name: 'employeeName',
      oiddepartment: 'departmentName',
      oidjobposition: 'positionName',
      probationstartdate: 'startDate',
      probationstopdate: 'plannedEndDate',
      试用结束日期: 'plannedEndDate',
      预计转正日期: 'plannedEndDate',
      部门名称: 'departmentName',
      职位名称: 'positionName',
    };
    return aliases[normalized];
  }

  private readProbationImportRow(
    columns: Map<ProbationImportFieldKey, number>,
    values: unknown[],
  ) {
    const input: Partial<Record<ProbationImportFieldKey, unknown>> = {};
    columns.forEach((index, field) => {
      const value = values[index];
      if (this.probationImportCellText(value) !== '') input[field] = value;
    });
    return input;
  }

  private decodeProbationImportCsv(buffer: Buffer) {
    const utf8 = buffer.toString('utf8').replace(/^﻿/, '');
    if (this.hasRecognizedProbationImportHeader(utf8)) return utf8;
    const gb18030 = new TextDecoder('gb18030').decode(buffer).replace(/^﻿/, '');
    return this.hasRecognizedProbationImportHeader(gb18030) ? gb18030 : utf8;
  }

  private hasRecognizedProbationImportHeader(value: string) {
    return (this.parseProbationImportCsv(value)[0] ?? []).some((header) => (
      this.resolveProbationImportHeader(header) !== undefined
    ));
  }

  private parseProbationImportCsv(value: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index]!;
      if (character === '"') {
        if (quoted && value[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && value[index + 1] === '\n') index += 1;
        row.push(cell);
        if (row.some((item) => item.length > 0)) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += character;
      }
    }
    row.push(cell);
    if (row.some((item) => item.length > 0)) rows.push(row);
    return rows;
  }

  private unwrapProbationImportCellValue(value: unknown): unknown {
    if (!value || typeof value !== 'object' || value instanceof Date) return value;
    const cell = value as {
      result?: unknown;
      text?: unknown;
      richText?: Array<{ text?: unknown }>;
    };
    if (cell.result !== undefined && cell.result !== null) {
      return this.unwrapProbationImportCellValue(cell.result);
    }
    if (Array.isArray(cell.richText)) {
      return cell.richText.map(({ text }) => String(text ?? '')).join('');
    }
    if (typeof cell.text === 'string') return cell.text;
    return value;
  }

  private probationImportCellText(value: unknown) {
    const resolved = this.unwrapProbationImportCellValue(value);
    if (resolved === null || resolved === undefined) return '';
    if (resolved instanceof Date) return resolved.toISOString().slice(0, 10);
    return String(resolved).trim();
  }

  private optionalProbationImportText(value: unknown) {
    const normalized = this.probationImportCellText(value).trim();
    return normalized || undefined;
  }

  private normalizeProbationImportHeader(value: string) {
    return value
      .replace(/^﻿/, '')
      .replace(/\u00a0/g, ' ')
      .trim()
      .replace(/[\s\r\n]+/g, '')
      .toLocaleLowerCase();
  }

  private normalizeProbationImportMatchText(value: string) {
    return value.replace(/[\s\u00a0]/g, '').toLocaleLowerCase();
  }

  private sameCalendarDate(first: Date, second: Date) {
    return first.getUTCFullYear() === second.getUTCFullYear()
      && first.getUTCMonth() === second.getUTCMonth()
      && first.getUTCDate() === second.getUTCDate();
  }

  private probationStatusLabel(status: ProcessStatus) {
    const labels: Record<ProcessStatus, string> = {
      DRAFT: '待发起',
      IN_PROGRESS: '考核中',
      PENDING: '待确认',
      APPROVED: '已通过',
      REJECTED: '已驳回',
      WITHDRAWN: '已撤回',
      COMPLETED: '已转正',
      CANCELLED: '已取消',
    };
    return labels[status];
  }

  private emptyEmploymentRecordPage(
    query: QueryEmploymentRecordsDto,
  ): Paginated<EmploymentRecordListItem> {
    return { data: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } };
  }

  private emptyInternPage(query: QueryInternsDto): Paginated<InternListItem> {
    return { data: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } };
  }

  private emptyLaborWorkerPage(query: QueryLaborWorkersDto): Paginated<LaborWorkerListItem> {
    return { data: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } };
  }

  private emptyPartTimePage(query: QueryPartTimeDto): Paginated<PartTimeListItem> {
    return { data: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } };
  }

  private emptyPage(query: QueryProbationDto): Paginated<ProbationListItem> {
    return { data: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } };
  }

  private emptyTrialPostPage(query: QueryTrialPostDto): Paginated<TrialPostListItem> {
    return { data: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } };
  }

  private emptyMovementPage(query: QueryEmployeeMovementsDto): Paginated<EmployeeMovementListItem> {
    return { data: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } };
  }

  private emptyTerminationPage(query: QueryTerminationsDto): Paginated<TerminationListItem> {
    return { data: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } };
  }

  private emptyRetirementPage(query: QueryRetirementsDto): Paginated<RetirementListItem> {
    return { data: [], meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } };
  }
}
