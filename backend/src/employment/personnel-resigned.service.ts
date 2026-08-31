import { Injectable } from '@nestjs/common';
import {
  AgreementStatus,
  AssignmentStatus,
  Prisma,
  ProcessStatus,
  RecordStatus,
} from '@prisma/client';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryPersonnelResignedDto } from './dto/query-personnel-resigned.dto';
import {
  presentPersonnelResigned,
  type PersonnelResignedListItem,
  type PersonnelResignedPresenterRow,
} from './personnel-resigned.presenter';

export interface PersonnelResignedPageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PersonnelResignedPage {
  data: PersonnelResignedListItem[];
  meta: PersonnelResignedPageMeta;
}

/**
 * Read model used only by the personnel-page "离职人员" table. It intentionally
 * differs from the employment-management termination list: rows are completed
 * termination records and do not expose employee-detail availability or actions.
 */
@Injectable()
export class PersonnelResignedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly demo: DemoDataService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: QueryPersonnelResignedDto,
  ): Promise<PersonnelResignedPage> {
    if (this.demo.enabled) return this.emptyPage(query);

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    if (!hasAllEmployeeData && accessibleOrganizationIds.length === 0) {
      return this.emptyPage(query);
    }

    // Employee master status is intentionally not a condition. This is a
    // historical completed-termination read model, so archived or disabled
    // employee masters must not erase an unarchived termination business row.
    const conditions: Prisma.TerminationRecordWhereInput[] = [
      { status: ProcessStatus.COMPLETED },
      { archivedAt: null },
    ];

    // Historical termination visibility is based on the primary assignment in
    // the same employment period on the resolved last-working date. It must
    // never fall back to the employee's current department.
    if (!hasAllEmployeeData) {
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
              AND assignment.start_date <= COALESCE(
                termination.actual_last_working_date,
                termination.planned_last_working_date
              )
              AND (
                assignment.end_date IS NULL
                OR assignment.end_date >= COALESCE(
                  termination.actual_last_working_date,
                  termination.planned_last_working_date
                )
              )
          )
      `);
      if (visibleRows.length === 0) return this.emptyPage(query);
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

    if (query.lastWorkingDateFrom || query.lastWorkingDateTo) {
      const range = {
        ...(query.lastWorkingDateFrom ? { gte: new Date(query.lastWorkingDateFrom) } : {}),
        ...(query.lastWorkingDateTo ? { lte: new Date(query.lastWorkingDateTo) } : {}),
      };
      conditions.push({
        OR: [
          { actualLastWorkingDate: range },
          { actualLastWorkingDate: null, plannedLastWorkingDate: range },
        ],
      });
    }

    const where: Prisma.TerminationRecordWhereInput = { AND: conditions };
    const select = Prisma.validator<Prisma.TerminationRecordSelect>()({
      id: true,
      employeeId: true,
      employmentPeriodId: true,
      plannedLastWorkingDate: true,
      actualLastWorkingDate: true,
      reason: true,
      employee: {
        select: {
          employeeNo: true,
          name: true,
          gender: true,
          mobile: true,
          identityDocuments: {
            where: { status: RecordStatus.ACTIVE, archivedAt: null },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
            select: { documentNumber: true, isPrimary: true },
          },
        },
      },
      employmentPeriod: { select: { entryDate: true } },
    });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.terminationRecord.findMany({
        where,
        select,
        orderBy: [{ plannedLastWorkingDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.terminationRecord.count({ where }),
    ]);

    const rowRelations = await Promise.all(rows.map(async (row) => {
      if (!row.employmentPeriodId) return { assignment: null, agreement: null };
      const lastWorkingDate = row.actualLastWorkingDate ?? row.plannedLastWorkingDate;
      const assignmentWhere: Prisma.EmployeeAssignmentWhereInput = {
        employeeId: row.employeeId,
        employmentPeriodId: row.employmentPeriodId,
        isPrimary: true,
        status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
        startDate: { lte: lastWorkingDate },
        OR: [{ endDate: null }, { endDate: { gte: lastWorkingDate } }],
        ...(hasAllEmployeeData ? {} : { organizationId: { in: accessibleOrganizationIds } }),
      };
      const agreementWhere: Prisma.EmployeeAgreementWhereInput = {
        employeeId: row.employeeId,
        employmentPeriodId: row.employmentPeriodId,
        status: AgreementStatus.ACTIVE,
        archivedAt: null,
        startDate: { lte: lastWorkingDate },
        OR: [{ endDate: null }, { endDate: { gte: lastWorkingDate } }],
        AND: [{ OR: [{ terminationDate: null }, { terminationDate: { gt: lastWorkingDate } }] }],
      };
      const [assignment, agreement] = await Promise.all([
        this.prisma.employeeAssignment.findFirst({
          where: assignmentWhere,
          orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
          select: {
            organization: { select: { name: true } },
            position: { select: { name: true } },
          },
        }),
        this.prisma.employeeAgreement.findFirst({
          where: agreementWhere,
          orderBy: [
            { startDate: 'desc' },
            { renewalSequence: 'desc' },
            { signingDate: 'desc' },
            { createdAt: 'desc' },
            { id: 'asc' },
          ],
          select: { employingCompany: { select: { name: true } } },
        }),
      ]);
      return { assignment, agreement };
    }));

    return {
      data: rows.map((row, index) => {
        const relation = rowRelations[index];
        const presenterRow: PersonnelResignedPresenterRow = {
          ...row,
          employmentPeriod: row.employmentPeriod
            ? {
                entryDate: row.employmentPeriod.entryDate,
                assignments: relation?.assignment ? [relation.assignment] : [],
                agreements: relation?.agreement ? [relation.agreement] : [],
              }
            : null,
        };
        return presentPersonnelResigned(presenterRow);
      }),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  private emptyPage(query: QueryPersonnelResignedDto): PersonnelResignedPage {
    return {
      data: [],
      meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 },
    };
  }
}
