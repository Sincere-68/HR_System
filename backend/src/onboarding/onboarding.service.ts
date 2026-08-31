import { ConflictException, Injectable } from '@nestjs/common';
import { AgreementStatus, AssignmentStatus, EmploymentStatus, Prisma, ProcessStatus, RecordStatus } from '@prisma/client';
import {
  type EmployeeIntroductionListItem,
  type IdCardReadListItem,
  type OfferListItem,
  type OfferListView,
  type OnboardingEntryListItem,
  type OnboardingIntegrationListItem,
  type Paginated,
  type PaginatedOfferList,
} from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { DemoDataService } from '../demo/demo-data.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { QueryOnboardingListDto } from './dto/query-onboarding-list.dto';
import { QueryOffersDto } from './dto/query-offers.dto';

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function compareDatesDesc(left: Date | null | undefined, right: Date | null | undefined) {
  if (left && right) return right.getTime() - left.getTime();
  if (left) return -1;
  if (right) return 1;
  return 0;
}

const ACTIVE_TERMINATION_STATUSES: ProcessStatus[] = [
  ProcessStatus.APPROVED,
  ProcessStatus.IN_PROGRESS,
  ProcessStatus.COMPLETED,
];

interface TerminationCandidate {
  id: string;
  actualLastWorkingDate: Date | null;
  plannedLastWorkingDate: Date;
  createdAt: Date;
}

function compareTerminationRecords(left: TerminationCandidate, right: TerminationCandidate) {
  const leftEffectiveDate = left.actualLastWorkingDate ?? left.plannedLastWorkingDate ?? left.createdAt;
  const rightEffectiveDate = right.actualLastWorkingDate ?? right.plannedLastWorkingDate ?? right.createdAt;
  return compareDatesDesc(leftEffectiveDate, rightEffectiveDate) || left.id.localeCompare(right.id);
}

function hasNoActualEntryDate(): Prisma.OfferWhereInput {
  return {
    OR: [
      { onboardingCase: { is: null } },
      { onboardingCase: { is: { actualEntryDate: null } } },
    ],
  };
}

function getOfferViewWhere(baseWhere: Prisma.OfferWhereInput, view: OfferListView): Prisma.OfferWhereInput {
  switch (view) {
    case 'ONBOARDED':
      return { AND: [baseWhere, { onboardingCase: { is: { actualEntryDate: { not: null } } } }] };
    case 'REJECTED':
      return { AND: [baseWhere, hasNoActualEntryDate(), { status: ProcessStatus.REJECTED }] };
    case 'ACCEPTED':
      return {
        AND: [
          baseWhere,
          hasNoActualEntryDate(),
          { status: { not: ProcessStatus.REJECTED } },
          { acceptedAt: { not: null } },
        ],
      };
    case 'SENT':
      return {
        AND: [
          baseWhere,
          hasNoActualEntryDate(),
          { status: { not: ProcessStatus.REJECTED } },
          { acceptedAt: null },
          { issueDate: { not: null } },
        ],
      };
    case 'PENDING_SEND':
      return {
        AND: [
          baseWhere,
          hasNoActualEntryDate(),
          { status: { not: ProcessStatus.REJECTED } },
          { acceptedAt: null },
          { issueDate: null },
        ],
      };
    case 'ALL':
      return baseWhere;
  }
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly demo: DemoDataService,
  ) {}

  async findOffers(user: AuthenticatedUser, query: QueryOffersDto): Promise<PaginatedOfferList> {
    this.assertMysqlMode();

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const baseWhere: Prisma.OfferWhereInput = { archivedAt: null };
    if (!hasAllEmployeeData) {
      const organizationIds = (await this.access.getAccessibleOrganizationIds(user)) ?? [];
      baseWhere.organizationId = { in: organizationIds };
    }

    const view: OfferListView = query.view ?? 'PENDING_SEND';
    const where = getOfferViewWhere(baseWhere, view);
    const candidateSelect: Prisma.CandidateSelect = {
      name: true,
      mobile: true,
      email: true,
      resumeAttachmentId: true,
    };
    const offerSelect = {
      id: true,
      status: true,
      proposedEntryDate: true,
      probationMonths: true,
      issueDate: true,
      acceptedAt: true,
      rejectedReason: true,
      candidate: { select: candidateSelect },
      acceptedEmployee: { select: { gender: true } },
      organization: { select: { name: true } },
      position: { select: { name: true } },
      workplace: { select: { name: true } },
      onboardingCase: {
        select: {
          actualEntryDate: true,
          employee: { select: { gender: true } },
        },
      },
    } satisfies Prisma.OfferSelect;

    const [rows, total, pendingSend, sent, accepted, rejected, onboarded, all] = await this.prisma.$transaction([
      this.prisma.offer.findMany({
        where,
        select: offerSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.offer.count({ where }),
      this.prisma.offer.count({ where: getOfferViewWhere(baseWhere, 'PENDING_SEND') }),
      this.prisma.offer.count({ where: getOfferViewWhere(baseWhere, 'SENT') }),
      this.prisma.offer.count({ where: getOfferViewWhere(baseWhere, 'ACCEPTED') }),
      this.prisma.offer.count({ where: getOfferViewWhere(baseWhere, 'REJECTED') }),
      this.prisma.offer.count({ where: getOfferViewWhere(baseWhere, 'ONBOARDED') }),
      this.prisma.offer.count({ where: getOfferViewWhere(baseWhere, 'ALL') }),
    ]);

    const attachmentIds = rows.flatMap((row) => row.candidate.resumeAttachmentId
      ? [row.candidate.resumeAttachmentId]
      : []);
    const activeAttachmentIds = attachmentIds.length === 0
      ? new Set<string>()
      : new Set((await this.prisma.fileAttachment.findMany({
        where: { id: { in: attachmentIds }, status: RecordStatus.ACTIVE, archivedAt: null },
        select: { id: true },
      })).map(({ id }) => id));

    return {
      data: rows.map((row): OfferListItem => {
        const resumeAttachmentId = row.candidate.resumeAttachmentId;
        return {
          id: row.id,
          name: row.candidate.name,
          personalEmail: row.candidate.email,
          mobile: row.candidate.mobile,
          gender: row.onboardingCase?.employee.gender ?? row.acceptedEmployee?.gender ?? null,
          organizationName: row.organization?.name ?? null,
          appliedPositionName: null,
          offeredPositionName: row.position?.name ?? null,
          workplaceName: row.workplace?.name ?? null,
          proposedEntryDate: formatDate(row.proposedEntryDate),
          probationMonths: row.probationMonths,
          offerSenderName: null,
          issueDate: formatDate(row.issueDate),
          recommenderName: null,
          acceptedAt: formatDate(row.acceptedAt),
          syncStatus: null,
          rejectedAt: null,
          rejectedReason: row.rejectedReason,
          entryDate: formatDate(row.onboardingCase?.actualEntryDate),
          approvalStatus: null,
          currentApproverName: null,
          offerStatus: row.status,
          resumeInfo: resumeAttachmentId && activeAttachmentIds.has(resumeAttachmentId)
            ? 'AVAILABLE'
            : null,
        };
      }),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
        viewCounts: { pendingSend, sent, accepted, rejected, onboarded, all },
      },
    };
  }

  async findEntries(user: AuthenticatedUser, query: QueryOnboardingListDto): Promise<Paginated<OnboardingEntryListItem>> {
    this.assertMysqlMode();

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const where: Prisma.OnboardingCaseWhereInput = { archivedAt: null };
    if (!hasAllEmployeeData) {
      const organizationIds = (await this.access.getAccessibleOrganizationIds(user)) ?? [];
      where.offer = { is: { organizationId: { in: organizationIds } } };
    }

    const now = new Date();
    const entrySelect = {
      id: true,
      status: true,
      plannedEntryDate: true,
      employee: {
        select: {
          name: true,
          gender: true,
          reportingAsEmployee: {
            where: {
              status: RecordStatus.ACTIVE,
              archivedAt: null,
              isPrimary: true,
              startDate: { lte: now },
              OR: [{ endDate: null }, { endDate: { gte: now } }],
            },
            orderBy: [{ startDate: 'desc' as const }, { id: 'asc' as const }],
            take: 1,
            select: { manager: { select: { name: true } } },
          },
          employmentPeriods: {
            where: {
              status: RecordStatus.ACTIVE,
              archivedAt: null,
              employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
              actualExitDate: null,
            },
            orderBy: [{ sequenceNo: 'desc' as const }],
            take: 1,
            select: { id: true },
          },
          agreements: {
            where: {
              archivedAt: null,
              status: AgreementStatus.ACTIVE,
              startDate: { lte: now },
              AND: [
                { OR: [{ endDate: null }, { endDate: { gte: now } }] },
                { OR: [{ terminationDate: null }, { terminationDate: { gt: now } }] },
              ],
            },
            orderBy: [{ startDate: 'desc' as const }, { id: 'asc' as const }],
            select: {
              id: true,
              employmentPeriodId: true,
              agreementType: true,
              startDate: true,
              terminationDate: true,
              employingCompany: { select: { name: true } },
            },
          },
        },
      },
      offer: {
        select: {
          organization: { select: { name: true } },
          workplace: { select: { name: true } },
          position: { select: { name: true } },
          candidate: { select: { source: true } },
        },
      },
    } satisfies Prisma.OnboardingCaseSelect;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.onboardingCase.findMany({
        where,
        select: entrySelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.onboardingCase.count({ where }),
    ]);

    return {
      data: rows.map((row) => {
        const currentPeriod = row.employee.employmentPeriods[0] ?? null;
        const currentAgreements = currentPeriod
          ? row.employee.agreements.filter(({ employmentPeriodId }) => employmentPeriodId === currentPeriod.id)
          : [];
        const agreement = currentAgreements.length === 1 ? currentAgreements[0] : null;
        return {
          id: row.id,
          name: row.employee.name,
          gender: row.employee.gender,
          plannedOrganizationName: row.offer?.organization?.name ?? null,
          plannedEntryDate: row.plannedEntryDate.toISOString().slice(0, 10),
          entryType: null,
          plannedWorkplaceName: row.offer?.workplace?.name ?? null,
          positionName: row.offer?.position?.name ?? null,
          jobLevel: null,
          managerName: row.employee.reportingAsEmployee[0]?.manager.name ?? null,
          onboardingStatus: row.status,
          preparationStatus: null,
          informationCollectionStatus: null,
          materialStatus: null,
          employmentRelationship: null,
          fullTimeCompany: agreement?.employingCompany?.name ?? null,
          contractType: agreement?.agreementType ?? null,
          effectiveDate: agreement?.startDate.toISOString().slice(0, 10) ?? null,
          terminationDate: agreement?.terminationDate?.toISOString().slice(0, 10) ?? null,
          dataSource: row.offer?.candidate?.source ?? null,
          currentApproverName: null,
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

  async findIntegration(user: AuthenticatedUser, query: QueryOnboardingListDto): Promise<Paginated<OnboardingIntegrationListItem>> {
    this.assertMysqlMode();

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const organizationIds = hasAllEmployeeData
      ? null
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const now = new Date();
    const currentAssignmentWhere: Prisma.EmployeeAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
    };
    const where: Prisma.OnboardingIntegrationRecordWhereInput = {
      archivedAt: null,
      ...(organizationIds ? {
        employee: { assignments: { some: currentAssignmentWhere } },
      } : {}),
    };
    const integrationSelect = {
      id: true,
      status: true,
      employee: {
        select: {
          name: true,
          assignments: {
            where: { ...currentAssignmentWhere, isPrimary: true },
            orderBy: [{ startDate: 'desc' as const }, { id: 'asc' as const }],
            take: 1,
            select: {
              organization: { select: { name: true } },
              jobTitle: { select: { name: true } },
            },
          },
          employmentPeriods: {
            where: {
              status: RecordStatus.ACTIVE,
              archivedAt: null,
              employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
              actualExitDate: null,
            },
            orderBy: [{ sequenceNo: 'desc' as const }],
            take: 1,
            select: { entryDate: true },
          },
          reportingAsEmployee: {
            where: {
              status: RecordStatus.ACTIVE,
              archivedAt: null,
              isPrimary: true,
              startDate: { lte: now },
              OR: [{ endDate: null }, { endDate: { gte: now } }],
            },
            orderBy: [{ startDate: 'desc' as const }, { id: 'asc' as const }],
            take: 1,
            select: { manager: { select: { name: true } } },
          },
        },
      },
    } satisfies Prisma.OnboardingIntegrationRecordSelect;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.onboardingIntegrationRecord.findMany({
        where,
        select: integrationSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.onboardingIntegrationRecord.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        employeeName: row.employee.name,
        organizationName: row.employee.assignments[0]?.organization.name ?? null,
        jobTitleName: row.employee.assignments[0]?.jobTitle?.name ?? null,
        entryDate: row.employee.employmentPeriods[0]?.entryDate.toISOString().slice(0, 10) ?? null,
        managerName: row.employee.reportingAsEmployee[0]?.manager.name ?? null,
        integrationStatus: row.status,
        integrationProgress: null,
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findIntroduction(user: AuthenticatedUser, query: QueryOnboardingListDto): Promise<Paginated<EmployeeIntroductionListItem>> {
    this.assertMysqlMode();

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const organizationIds = hasAllEmployeeData
      ? null
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const now = new Date();
    const currentAssignmentWhere: Prisma.EmployeeAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
    };
    const where: Prisma.EmployeeIntroductionWhereInput = {
      archivedAt: null,
      ...(organizationIds ? {
        employee: { assignments: { some: currentAssignmentWhere } },
      } : {}),
    };
    const introductionSelect = {
      id: true,
      status: true,
      employee: {
        select: {
          name: true,
          gender: true,
          assignments: {
            where: { ...currentAssignmentWhere, isPrimary: true },
            orderBy: [{ startDate: 'desc' as const }, { id: 'asc' as const }],
            take: 1,
            select: {
              organization: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
          employmentPeriods: {
            where: {
              status: RecordStatus.ACTIVE,
              archivedAt: null,
              employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
              actualExitDate: null,
            },
            orderBy: [{ sequenceNo: 'desc' as const }],
            take: 1,
            select: { entryDate: true },
          },
        },
      },
    } satisfies Prisma.EmployeeIntroductionSelect;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeIntroduction.findMany({
        where,
        select: introductionSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeIntroduction.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        name: row.employee.name,
        gender: row.employee.gender,
        organizationName: row.employee.assignments[0]?.organization.name ?? null,
        positionName: row.employee.assignments[0]?.position?.name ?? null,
        entryDate: row.employee.employmentPeriods[0]?.entryDate.toISOString().slice(0, 10) ?? null,
        introductionStatus: row.status,
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findIdCardReader(user: AuthenticatedUser, query: QueryOnboardingListDto): Promise<Paginated<IdCardReadListItem>> {
    this.assertMysqlMode();

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const now = new Date();
    const currentAssignmentWhere: Prisma.EmployeeAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    };
    const accessibleOrganizationIds = hasAllEmployeeData
      ? null
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const where: Prisma.EmployeeIdentityDocumentWhereInput = {
      documentType: 'NATIONAL_ID',
      status: RecordStatus.ACTIVE,
      archivedAt: null,
      ...(accessibleOrganizationIds ? {
        employee: { assignments: { some: { ...currentAssignmentWhere, organizationId: { in: accessibleOrganizationIds } } } },
      } : {}),
    };

    const terminationRecordSelect = {
      id: true,
      employmentPeriodId: true,
      plannedLastWorkingDate: true,
      actualLastWorkingDate: true,
      terminationType: true,
      status: true,
      reason: true,
      createdAt: true,
      employmentPeriod: {
        select: {
          assignments: {
            select: {
              id: true,
              organization: { select: { id: true, name: true } },
              isPrimary: true,
              status: true,
              archivedAt: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      },
    } satisfies Prisma.TerminationRecordSelect;
    const employeeSelect = {
      name: true,
      gender: true,
      ethnicity: true,
      birthDate: true,
      householdAddress: true,
      terminationRecords: {
        where: { status: { in: ACTIVE_TERMINATION_STATUSES }, archivedAt: null },
        orderBy: [
          { actualLastWorkingDate: 'desc' as const },
          { plannedLastWorkingDate: 'desc' as const },
          { createdAt: 'desc' as const },
          { id: 'asc' as const },
        ],
        select: terminationRecordSelect,
      },
    } satisfies Prisma.EmployeeSelect;
    const idCardSelect = {
      id: true,
      documentType: true,
      documentNumber: true,
      issuingAuthority: true,
      issueDate: true,
      expiryDate: true,
      createdAt: true,
      employee: { select: employeeSelect },
    } satisfies Prisma.EmployeeIdentityDocumentSelect;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeIdentityDocument.findMany({
        where,
        select: idCardSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeIdentityDocument.count({ where }),
    ]);

    return {
      data: rows.map((row) => {
        const termination = [...row.employee.terminationRecords].sort(compareTerminationRecords)[0] ?? null;
        const actualLastWorkingDate = termination?.actualLastWorkingDate ?? null;
        const previousOrganizationName = actualLastWorkingDate
          && termination?.employmentPeriodId
          && 'employmentPeriod' in termination
          && termination.employmentPeriod
          ? [...termination.employmentPeriod.assignments]
            .filter((assignment) => (
              (accessibleOrganizationIds === null || accessibleOrganizationIds.includes(assignment.organization.id))
              && assignment.status === AssignmentStatus.ACTIVE
              && assignment.archivedAt === null
              && assignment.isPrimary
              && assignment.startDate.getTime() <= actualLastWorkingDate.getTime()
              && (assignment.endDate === null || assignment.endDate.getTime() >= actualLastWorkingDate.getTime())
            ))
            .sort((left, right) => (
              compareDatesDesc(left.startDate, right.startDate) || left.id.localeCompare(right.id)
            ))[0]?.organization.name ?? null
          : null;

        return {
          id: row.id,
          name: row.employee.name,
          gender: row.employee.gender,
          ethnicity: row.employee.ethnicity,
          birthDate: formatDate(row.employee.birthDate),
          householdAddress: row.employee.householdAddress,
          documentType: row.documentType,
          documentNumber: row.documentNumber,
          issuingAuthority: row.issuingAuthority,
          issueDate: formatDate(row.issueDate),
          expiryDate: formatDate(row.expiryDate),
          lastWorkingDate: formatDate(actualLastWorkingDate),
          previousOrganizationName,
          terminationType: termination?.terminationType ?? null,
          terminationReason: termination?.reason ?? null,
          photo: null,
          recordedBy: null,
          recordedAt: row.createdAt.toISOString(),
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

  private assertMysqlMode() {
    if (this.demo.enabled) throw new ConflictException('录用入职模块仅支持 MySQL 模式');
  }

  private emptyPage<T>(query: QueryOnboardingListDto): Paginated<T> {
    void this.prisma;
    void this.access;
    return {
      data: [],
      meta: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 },
    };
  }
}
