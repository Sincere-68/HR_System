import { Injectable } from '@nestjs/common';
import {
  AssignmentStatus,
  EmploymentRelationship,
  EmploymentStatus,
  Prisma,
  RecordStatus,
  ReportingRelationshipType,
} from '@prisma/client';
import type { Paginated } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryPersonnelLaborWorkersDto } from './dto/query-personnel-labor-workers.dto';
import {
  type PersonnelLaborWorkerListItem,
  presentPersonnelLaborWorker,
} from './personnel-labor-worker.presenter';

function utcCalendarDay(value = new Date()) {
  return new Date(Date.UTC(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ));
}

/**
 * Read model for the personnel page's labor-worker table. This deliberately
 * does not reuse the employment-management labor-worker endpoint or contract.
 */
@Injectable()
export class PersonnelLaborWorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly demo: DemoDataService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: QueryPersonnelLaborWorkersDto,
  ): Promise<Paginated<PersonnelLaborWorkerListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const now = new Date();
    const today = utcCalendarDay(now);

    const requestedEntryDateTo = query.entryDateTo ? new Date(query.entryDateTo) : null;
    const latestEntryDate = requestedEntryDateTo && requestedEntryDateTo < today
      ? requestedEntryDateTo
      : today;
    const currentLaborPeriod: Prisma.EmploymentPeriodWhereInput = {
      employmentRelationship: EmploymentRelationship.LABOR_WORKER,
      employmentStatus: {
        in: [
          EmploymentStatus.PROBATION,
          EmploymentStatus.REGULAR,
          EmploymentStatus.NON_REGULAR,
        ],
      },
      actualExitDate: null,
      entryDate: {
        lte: latestEntryDate,
        ...(query.entryDateFrom ? { gte: new Date(query.entryDateFrom) } : {}),
      },
      status: RecordStatus.ACTIVE,
      archivedAt: null,
    };

    // Query EmployeeAssignment as the row source so employmentPeriodId is an
    // explicit foreign-key relation, not an employee-wide current assignment.
    // `employmentPeriod.is` guarantees the displayed assignment is from the
    // exact current LABOR_WORKER period supplying the entry date.
    const conditions: Prisma.EmployeeAssignmentWhereInput[] = [
      { isPrimary: true },
      { status: AssignmentStatus.ACTIVE },
      { archivedAt: null },
      { startDate: { lte: today } },
      { OR: [{ endDate: null }, { endDate: { gte: today } }] },
      { employmentPeriod: { is: currentLaborPeriod } },
      { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
    ];
    if (!hasAllEmployeeData) {
      conditions.push({ organizationId: { in: accessibleOrganizationIds } });
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

    const where: Prisma.EmployeeAssignmentWhereInput = { AND: conditions };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeAssignment.findMany({
        where,
        select: {
          employeeId: true,
          employmentPeriodId: true,
          employee: { select: { employeeNo: true, name: true, workEmail: true } },
          employmentPeriod: { select: { entryDate: true } },
          organization: { select: { name: true } },
          jobTitle: { select: { name: true } },
          position: { select: { name: true } },
          workArrangement: true,
        },
        orderBy: [{ employmentPeriod: { entryDate: 'desc' } }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeAssignment.count({ where }),
    ]);

    // Direct manager means a current effective primary administrative reporting
    // relationship. The deterministic ordering is retained from labor-worker
    // management in case invalid duplicate primary relationships exist.
    const managerRows = await Promise.all(rows.map((row) => this.prisma.reportingRelationship.findFirst({
      where: {
        employeeId: row.employeeId,
        relationshipType: ReportingRelationshipType.ADMINISTRATIVE,
        isPrimary: true,
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
        manager: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } },
      },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
      select: { manager: { select: { name: true } } },
    })));

    // Visibility of this current personnel row and its detail action are
    // separate. The detail action is calculated from the employee's current
    // assignment scope, not merely from a visible period row.
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
      data: rows.flatMap((row, index) => {
        if (!row.employmentPeriod) return [];
        return [presentPersonnelLaborWorker({
          employeeId: row.employeeId,
          entryDate: row.employmentPeriod.entryDate,
          employee: row.employee,
          assignments: [{
            organization: row.organization,
            jobTitle: row.jobTitle,
            position: row.position,
            workArrangement: row.workArrangement,
          }],
        }, {
          managerName: managerRows[index]?.manager.name ?? null,
          canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
        })];
      }),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  private emptyPage(
    query: QueryPersonnelLaborWorkersDto,
  ): Paginated<PersonnelLaborWorkerListItem> {
    return {
      data: [],
      meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 },
    };
  }
}
