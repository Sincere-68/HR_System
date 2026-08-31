import { Injectable } from '@nestjs/common';
import { AgreementStatus, AssignmentStatus, EmploymentStatus, Prisma, RecordStatus } from '@prisma/client';
import { type ContractListItem, type Paginated } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryContractsDto } from './dto/query-contracts.dto';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly demo: DemoDataService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: QueryContractsDto,
  ): Promise<Paginated<ContractListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const today = this.today();
    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? undefined
      : await this.access.getAccessibleOrganizationIds(user);

    if (!hasAllEmployeeData && (accessibleOrganizationIds ?? []).length === 0) {
      return this.emptyPage(query);
    }

    let selectedOrganizationIds: string[] | undefined;
    if (query.organizationId) {
      selectedOrganizationIds = await this.access.getOrganizationSubtreeIds(
        query.organizationId,
        hasAllEmployeeData ? undefined : accessibleOrganizationIds ?? [],
      );
      if (selectedOrganizationIds.length === 0) return this.emptyPage(query);
    }

    const currentAssignment = this.currentAssignmentWhere(
      today,
      hasAllEmployeeData ? selectedOrganizationIds : selectedOrganizationIds ?? accessibleOrganizationIds ?? [],
    );

    const conditions: Prisma.EmployeeAgreementWhereInput[] = [
      { status: AgreementStatus.ACTIVE },
      { archivedAt: null },
      { startDate: { lte: today } },
      { OR: [{ endDate: null }, { endDate: { gte: today } }] },
      { OR: [{ terminationDate: null }, { terminationDate: { gt: today } }] },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
    ];

    const keyword = query.keyword?.trim();
    if (keyword) {
      conditions.push({
        employee: {
          is: {
            OR: [
              { employeeNo: { contains: keyword } },
              { name: { contains: keyword } },
            ],
          },
        },
      });
    }

    if (!hasAllEmployeeData) {
      conditions.push({
        employmentPeriod: {
          is: {
            status: RecordStatus.ACTIVE,
            archivedAt: null,
            employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
            actualExitDate: null,
            assignments: { some: currentAssignment },
          },
        },
      });
    } else if (selectedOrganizationIds) {
      conditions.push({
        employmentPeriod: {
          is: { assignments: { some: currentAssignment } },
        },
      });
    }

    const where: Prisma.EmployeeAgreementWhereInput = { AND: conditions };
    const assignmentWhere = this.currentAssignmentWhere(
      today,
      hasAllEmployeeData ? selectedOrganizationIds : selectedOrganizationIds ?? accessibleOrganizationIds ?? [],
    );
    const select = Prisma.validator<Prisma.EmployeeAgreementSelect>()({
      id: true,
      agreementType: true,
      startDate: true,
      endDate: true,
      employee: { select: { employeeNo: true, name: true } },
      employmentPeriod: {
        select: {
          entryDate: true,
          assignments: {
            where: { ...assignmentWhere, isPrimary: true },
            orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
            take: 1,
            select: {
              organization: { select: { name: true } },
            },
          },
        },
      },
      employingCompany: { select: { name: true } },
    });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeAgreement.findMany({
        where,
        select,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeAgreement.count({ where }),
    ]);

    return {
      data: rows.map((row) => {
        const assignment = row.employmentPeriod?.assignments[0];
        return {
          id: row.id,
          employeeNo: row.employee.employeeNo,
          employeeName: row.employee.name,
          departmentName: assignment?.organization.name ?? null,
          entryDate: formatDate(row.employmentPeriod?.entryDate ?? null),
          fullTimeCompany: row.employingCompany?.name ?? null,
          agreementType: row.agreementType,
          termType: row.endDate ? 'FIXED' : 'OPEN_ENDED',
          effectiveDate: formatDate(row.startDate) as string,
          endDate: formatDate(row.endDate),
          latestElectronicSignatureStatus: null,
          latestElectronicAgreementAttachment: null,
          electronicSignatureRecords: null,
          contractRemark: null,
        };
      }),
      meta: this.pageMeta(query, total),
    };
  }

  private currentAssignmentWhere(
    today: Date,
    organizationIds?: string[],
  ): Prisma.EmployeeAssignmentWhereInput {
    return {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
      ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
    };
  }

  private today() {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  private pageMeta(query: QueryContractsDto, total: number) {
    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  private emptyPage(query: QueryContractsDto): Paginated<ContractListItem> {
    return { data: [], meta: this.pageMeta(query, 0) };
  }
}

function formatDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
