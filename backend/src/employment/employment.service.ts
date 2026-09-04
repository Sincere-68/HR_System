import { Injectable } from '@nestjs/common';
import { createTableExport } from '../common/table-export';
import {
  ApprovalDecision,
  AssignmentStatus,
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
  type ProbationListItem,
  type RetirementListItem,
  type TerminationListItem,
  type TrialPostListItem,
} from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryEmployeeMovementsDto } from './dto/query-employee-movements.dto';
import { QueryEmploymentRecordsDto } from './dto/query-employment-records.dto';
import { QueryInternsDto } from './dto/query-interns.dto';
import { QueryLaborWorkersDto } from './dto/query-labor-workers.dto';
import { QueryPartTimeDto } from './dto/query-part-time.dto';
import { QueryProbationDto } from './dto/query-probation.dto';
import { QueryRetirementsDto } from './dto/query-retirements.dto';
import { QueryTrialPostDto } from './dto/query-trial-post.dto';
import { QueryTerminationsDto } from './dto/query-terminations.dto';
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
    if (this.demo.enabled) return this.emptyInternPage(query);

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
          startDate: row.entryDate.toISOString().slice(0, 10),
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
      keyword: query.keyword,
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
    if (this.demo.enabled) return this.emptyLaborWorkerPage(query);

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

  async findPartTime(user: AuthenticatedUser, query: QueryPartTimeDto): Promise<Paginated<PartTimeListItem>> {
    if (this.demo.enabled) return this.emptyPartTimePage(query);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const today = utcCalendarDay();
    const conditions: Prisma.EmployeeAssignmentWhereInput[] = [
      { workArrangement: 'PART_TIME' },
      { status: AssignmentStatus.ACTIVE },
      { archivedAt: null },
      { startDate: { lte: today } },
      { OR: [{ endDate: null }, { endDate: { gte: today } }] },
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

  async findProbation(user: AuthenticatedUser, query: QueryProbationDto): Promise<Paginated<ProbationListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

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
    if (!hasAllEmployeeData) {
      if (accessibleOrganizationIds.length === 0) return this.emptyPage(query);
      const visibleRows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT probation.id
        FROM probation_records AS probation
        WHERE probation.employment_period_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM employee_assignments AS assignment
            WHERE assignment.employee_id = probation.employee_id
              AND assignment.employment_period_id = probation.employment_period_id
              AND assignment.organization_id IN (${Prisma.join(accessibleOrganizationIds)})
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
    if (query.view === 'expiring') {
      const inThirtyDays = new Date(today);
      inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 30);
      conditions.push({
        status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.CANCELLED] },
        plannedEndDate: { gte: today, lte: inThirtyDays },
      });
    } else if (query.view === 'reviewing') {
      conditions.push({ status: ProcessStatus.IN_PROGRESS });
    } else if (query.view === 'approval') {
      conditions.push({ status: ProcessStatus.PENDING });
    } else if (query.view === 'completed') {
      conditions.push({ status: ProcessStatus.COMPLETED });
    }
    if (query.status) conditions.push({ status: query.status });
    if (query.startDateFrom || query.startDateTo) {
      conditions.push({ startDate: { ...(query.startDateFrom ? { gte: new Date(query.startDateFrom) } : {}), ...(query.startDateTo ? { lte: new Date(query.startDateTo) } : {}) } });
    }
    if (query.plannedEndDateFrom || query.plannedEndDateTo) {
      conditions.push({ plannedEndDate: { ...(query.plannedEndDateFrom ? { gte: new Date(query.plannedEndDateFrom) } : {}), ...(query.plannedEndDateTo ? { lte: new Date(query.plannedEndDateTo) } : {}) } });
    }
    const where: Prisma.ProbationRecordWhereInput = { AND: conditions };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.probationRecord.findMany({
        where,
        select: { id: true, employeeId: true, employmentPeriodId: true, startDate: true, plannedEndDate: true, employee: { select: { employeeNo: true, name: true } } },
        orderBy: [{ plannedEndDate: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.probationRecord.count({ where }),
    ]);
    const assignments = await Promise.all(rows.map((row) => row.employmentPeriodId
      ? this.prisma.employeeAssignment.findFirst({
          where: {
            employeeId: row.employeeId,
            employmentPeriodId: row.employmentPeriodId,
            status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
            startDate: { lte: row.startDate },
            OR: [{ endDate: null }, { endDate: { gte: row.startDate } }],
            ...(hasAllEmployeeData ? {} : { organizationId: { in: accessibleOrganizationIds } }),
          },
          select: { organization: { select: { name: true } }, position: { select: { name: true } } },
          orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
        })
      : Promise.resolve(null)));
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
      data: rows.map((row, index) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeNo: row.employee.employeeNo,
        employeeName: row.employee.name ?? '--',
        departmentName: assignments[index]?.organization.name ?? null,
        positionName: assignments[index]?.position?.name ?? null,
        startDate: row.startDate.toISOString().slice(0, 10),
        plannedEndDate: row.plannedEndDate.toISOString().slice(0, 10),
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    };
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
