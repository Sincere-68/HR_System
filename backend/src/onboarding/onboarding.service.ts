import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AgreementStatus,
  AssignmentStatus,
  EmploymentRelationship,
  EmploymentStatus,
  Prisma,
  ReportingRelationshipType,
  ProcessStatus,
  RecordStatus,
} from '@prisma/client';
import {
  type CreatedInternOffer,
  type EmployeeExportInput,
  type CreateInternOfferInput,
  type EmployeeIntroductionListItem,
  type IdCardReadListItem,
  type InternConversionEmployeeOption,
  type InternConversionOfferPrefill,
  type InternOfferFormOptions,
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
import { createTableExport } from '../common/table-export';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInternOfferDto } from './dto/create-intern-offer.dto';
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
const INTERN_OFFER_NUMBER_RETRY_LIMIT = 3;
const INTERN_OFFER_NUMBER_PREFIX = 'INTERN-';

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

  async getInternOfferFormOptions(user: AuthenticatedUser): Promise<InternOfferFormOptions> {
    this.assertInternOfferMysqlMode();

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? null
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    // Match employee-form manager-option semantics exactly: scoped users use
    // the current accessible employee predicate; all-data users receive it unfiltered.
    const managerWhere = hasAllEmployeeData
      ? undefined
      : await this.access.getEmployeeWhere(user, accessibleOrganizationIds ?? undefined);
    const organizationWhere: Prisma.OrganizationWhereInput = {
      status: RecordStatus.ACTIVE,
      archivedAt: null,
      ...(accessibleOrganizationIds === null ? {} : { id: { in: accessibleOrganizationIds } }),
    };
    const positionWhere: Prisma.PositionWhereInput = {
      status: RecordStatus.ACTIVE,
      archivedAt: null,
    };

    const [organizations, positions, managers, employingCompanies] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where: organizationWhere,
        select: { id: true, name: true, parentId: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.position.findMany({
        where: positionWhere,
        select: { id: true, name: true, organizationId: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.employee.findMany({
        where: { ...managerWhere, name: { not: null } },
        select: { id: true, name: true, employeeNo: true },
        orderBy: [{ employeeNo: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.employingCompany.findMany({
        where: { status: RecordStatus.ACTIVE, archivedAt: null },
        select: { id: true, name: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      organizations,
      positions,
      managers: managers.map(({ id, name, employeeNo }) => ({ id, name: name ?? '--', employeeNo })),
      employingCompanies,
    };
  }

  async createInternOffer(user: AuthenticatedUser, dto: CreateInternOfferDto | CreateInternOfferInput): Promise<CreatedInternOffer> {
    this.assertInternOfferMysqlMode();

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? null
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const proposedEntryDate = this.toDate(dto.proposedEntryDate);
    const contractEndDate = dto.contractEndDate ? this.toDate(dto.contractEndDate) : undefined;
    this.assertOfferContractTerms(dto.contractTermType, dto.contractMonths, contractEndDate, proposedEntryDate);

    for (let attempt = 0; attempt < INTERN_OFFER_NUMBER_RETRY_LIMIT; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await this.validateInternOfferRelations(user, dto, accessibleOrganizationIds, tx);
          const offerNo = await this.nextInternOfferNo(tx);
          const candidate = await tx.candidate.create({
            data: {
              name: dto.name,
              mobile: dto.mobile,
              email: dto.personalEmail,
              gender: dto.gender,
              birthDate: dto.birthDate ? this.toDate(dto.birthDate) : undefined,
              workStartDate: dto.workStartDate ? this.toDate(dto.workStartDate) : undefined,
              source: dto.source,
              status: ProcessStatus.DRAFT,
            },
            select: {
              id: true, name: true, mobile: true, email: true, source: true, gender: true, birthDate: true, workStartDate: true,
            },
          });
          const identityDocument = dto.identityDocument
            ? await tx.candidateIdentityDocument.create({
              data: {
                candidateId: candidate.id,
                documentType: dto.identityDocument.documentType,
                documentNumber: dto.identityDocument.documentNumber.toUpperCase(),
                isPrimary: dto.identityDocument.isPrimary ?? true,
                expiryDate: dto.identityDocument.expiryDate ? this.toDate(dto.identityDocument.expiryDate) : undefined,
                status: RecordStatus.ACTIVE,
              },
              select: { id: true, documentType: true, documentNumber: true, isPrimary: true, expiryDate: true },
            })
            : null;
          const educationExperience = dto.educationExperience
            ? await tx.candidateEducationExperience.create({
              data: {
                candidateId: candidate.id,
                schoolName: dto.educationExperience.schoolName,
                educationLevel: dto.educationExperience.educationLevel,
                major: dto.educationExperience.major,
                graduationDate: dto.educationExperience.graduationDate
                  ? this.toDate(dto.educationExperience.graduationDate)
                  : undefined,
                isHighestEducation: dto.educationExperience.isHighestEducation ?? true,
                status: RecordStatus.ACTIVE,
              },
              select: { id: true, schoolName: true, educationLevel: true, major: true, graduationDate: true, isHighestEducation: true },
            })
            : null;
          const offer = await tx.offer.create({
            data: {
              offerNo,
              candidateId: candidate.id,
              organizationId: dto.organizationId,
              positionId: dto.positionId,
              workplaceName: dto.workplaceName ?? null,
              proposedEntryDate,
              probationMonths: dto.probationMonths,
              jobLevel: dto.jobLevel,
              employeeLevel: dto.employeeLevel,
              personnelCategory: dto.personnelCategory,
              workArrangement: dto.workArrangement,
              directManagerEmployeeId: dto.directManagerEmployeeId,
              employingCompanyId: dto.employingCompanyId,
              agreementType: dto.agreementType,
              contractTermType: dto.contractTermType,
              contractMonths: dto.contractMonths,
              contractEndDate,
              isSeparatelySigned: dto.isSeparatelySigned,
              employmentRelationship: EmploymentRelationship.INTERN,
              status: ProcessStatus.DRAFT,
              issueDate: null,
            },
            select: {
              id: true, offerNo: true, organizationId: true, positionId: true, workplaceName: true,
              proposedEntryDate: true, probationMonths: true, jobLevel: true, employeeLevel: true,
              personnelCategory: true, workArrangement: true, directManagerEmployeeId: true,
              employingCompanyId: true, agreementType: true, contractTermType: true, contractMonths: true,
              contractEndDate: true, isSeparatelySigned: true, employmentRelationship: true, status: true, issueDate: true,
            },
          });
          const compensationSnapshot = dto.compensationSnapshot
            ? await tx.offerCompensationSnapshot.create({
              data: { offerId: offer.id, ...dto.compensationSnapshot, status: RecordStatus.ACTIVE },
              select: {
                salaryPackage: true, salaryRemark: true, preConfirmationBaseSalary: true, postConfirmationBaseSalary: true,
                preConfirmationMonthlyPerformance: true, postConfirmationMonthlyPerformance: true,
                preConfirmationMonthlyManagementPerformance: true, postConfirmationMonthlyManagementPerformance: true,
                fullTimeContractSalary: true, annualPerformance: true,
              },
            })
            : null;
          const partTimeSnapshot = dto.partTimeSnapshot
            ? await tx.offerPartTimeSnapshot.create({
              data: { offerId: offer.id, ...dto.partTimeSnapshot, status: RecordStatus.ACTIVE },
              select: { positionName: true, hourlyRate: true },
            })
            : null;
          return {
            id: offer.id,
            offerNo: offer.offerNo,
            candidate: {
              id: candidate.id,
              name: candidate.name,
              mobile: candidate.mobile!,
              personalEmail: candidate.email!,
              source: candidate.source as CreatedInternOffer['candidate']['source'],
              gender: candidate.gender,
              birthDate: formatDate(candidate.birthDate),
              workStartDate: formatDate(candidate.workStartDate),
              identityDocument: identityDocument && {
                ...identityDocument,
                expiryDate: formatDate(identityDocument.expiryDate),
              },
              educationExperience: educationExperience && {
                ...educationExperience,
                graduationDate: formatDate(educationExperience.graduationDate),
              },
            },
            organizationId: offer.organizationId!,
            positionId: offer.positionId!,
            workplaceName: offer.workplaceName,
            proposedEntryDate: formatDate(offer.proposedEntryDate)!,
            probationMonths: offer.probationMonths,
            jobLevel: offer.jobLevel,
            employeeLevel: offer.employeeLevel,
            personnelCategory: offer.personnelCategory,
            workArrangement: offer.workArrangement,
            directManagerEmployeeId: offer.directManagerEmployeeId,
            employingCompanyId: offer.employingCompanyId,
            agreementType: offer.agreementType,
            contractTermType: offer.contractTermType as CreatedInternOffer['contractTermType'],
            contractMonths: offer.contractMonths,
            contractEndDate: formatDate(offer.contractEndDate),
            isSeparatelySigned: offer.isSeparatelySigned,
            compensationSnapshot: compensationSnapshot && this.presentCompensationSnapshot(compensationSnapshot),
            partTimeSnapshot: partTimeSnapshot && this.presentPartTimeSnapshot(partTimeSnapshot),
            employmentRelationship: offer.employmentRelationship,
            status: offer.status,
            issueDate: formatDate(offer.issueDate),
          } as CreatedInternOffer;
        });
      } catch (error) {
        if (!this.isOfferNoUniqueConflict(error) || attempt === INTERN_OFFER_NUMBER_RETRY_LIMIT - 1) {
          throw error;
        }
      }
    }
    throw new ConflictException('实习 Offer 编号生成冲突，请重试');
  }

  /** Current, scoped employees with an active INTERN period for direct Offer conversion. */
  async getInternConversionOptions(user: AuthenticatedUser): Promise<InternConversionEmployeeOption[]> {
    this.assertInternOfferMysqlMode();
    const today = this.utcCalendarDay();
    const scope = this.access.hasAllEmployeeData(user)
      ? {}
      : await this.access.getEmployeeWhere(user, undefined, today);
    const employees = await this.prisma.employee.findMany({
      where: {
        recordStatus: RecordStatus.ACTIVE,
        archivedAt: null,
        ...scope,
        employmentPeriods: { some: this.currentInternPeriodWhere(today) },
        name: { not: null },
      },
      select: { id: true, name: true, employeeNo: true },
      orderBy: [{ employeeNo: 'asc' }, { id: 'asc' }],
    });
    return employees.map(({ id, name, employeeNo }) => ({ id, name: name ?? '--', employeeNo }));
  }

  /**
   * Reads, but never writes, mapped current-intern data for the direct Offer
   * form. The employee predicate includes the caller's current organization
   * scope, so an out-of-scope or no-longer-current intern is indistinguishable
   * from a missing one.
   */
  async getInternConversionOfferPrefill(
    user: AuthenticatedUser,
    employeeId: string,
  ): Promise<InternConversionOfferPrefill> {
    this.assertInternOfferMysqlMode();
    const today = this.utcCalendarDay();
    const scope = this.access.hasAllEmployeeData(user)
      ? {}
      : await this.access.getEmployeeWhere(user, undefined, today);
    const currentAssignmentWhere: Prisma.EmployeeAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      isPrimary: true,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    };
    const currentAgreementWhere: Prisma.EmployeeAgreementWhereInput = {
      status: AgreementStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: today },
      AND: [
        { OR: [{ endDate: null }, { endDate: { gte: today } }] },
        { OR: [{ terminationDate: null }, { terminationDate: { gt: today } }] },
      ],
    };
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        recordStatus: RecordStatus.ACTIVE,
        archivedAt: null,
        ...scope,
        employmentPeriods: { some: this.currentInternPeriodWhere(today) },
      },
      select: {
        name: true,
        mobile: true,
        personalEmail: true,
        gender: true,
        birthDate: true,
        identityDocuments: {
          where: { status: RecordStatus.ACTIVE, archivedAt: null, isPrimary: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 1,
          select: { documentType: true, documentNumber: true, expiryDate: true },
        },
        educationExperiences: {
          where: { status: RecordStatus.ACTIVE, archivedAt: null, isHighestEducation: true },
          orderBy: [{ graduationDate: 'desc' }, { id: 'asc' }],
          take: 1,
          select: { schoolName: true, educationLevel: true, major: true, graduationDate: true },
        },
        employmentPeriods: {
          where: this.currentInternPeriodWhere(today),
          orderBy: [{ sequenceNo: 'desc' }, { id: 'asc' }],
          take: 1,
          select: {
            id: true,
            personnelCategory: true,
            personnelSource: true,
            assignments: {
              where: currentAssignmentWhere,
              orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
              take: 1,
              select: {
                organizationId: true,
                positionId: true,
                workplaceName: true,
                jobLevel: true,
                employeeLevel: true,
                personnelCategory: true,
                workArrangement: true,
              },
            },
          },
        },
        reportingAsEmployee: {
          where: {
            status: RecordStatus.ACTIVE,
            archivedAt: null,
            relationshipType: ReportingRelationshipType.ADMINISTRATIVE,
            isPrimary: true,
            startDate: { lte: today },
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
          orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
          take: 1,
          select: { managerEmployeeId: true },
        },
        agreements: {
          where: currentAgreementWhere,
          orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
          select: {
            employmentPeriodId: true,
            employingCompanyId: true,
            agreementType: true,
            endDate: true,
          },
        },
      },
    });
    if (!employee) throw new NotFoundException('实习生不存在、已离职或不在当前数据范围内');

    const period = employee.employmentPeriods[0];
    if (!period) throw new NotFoundException('实习生不存在、已离职或不在当前数据范围内');
    const assignment = period.assignments[0] ?? null;
    const agreement = employee.agreements.find(({ employmentPeriodId }) => employmentPeriodId === period.id) ?? null;
    const document = employee.identityDocuments[0] ?? null;
    const education = employee.educationExperiences[0] ?? null;
    const documentExpiryDate = formatDate(document?.expiryDate);
    const graduationDate = formatDate(education?.graduationDate);

    return {
      name: employee.name ?? '--',
      mobile: employee.mobile ?? '--',
      personalEmail: employee.personalEmail,
      source: period.personnelSource as InternConversionOfferPrefill['source'],
      gender: employee.gender,
      birthDate: formatDate(employee.birthDate),
      identityDocument: document
        ? {
          documentType: document.documentType,
          documentNumber: document.documentNumber,
          isPrimary: true,
          ...(documentExpiryDate ? { expiryDate: documentExpiryDate } : {}),
        }
        : null,
      educationExperience: education
        ? {
          schoolName: education.schoolName,
          educationLevel: education.educationLevel,
          ...(education.major ? { major: education.major } : {}),
          ...(graduationDate ? { graduationDate } : {}),
          isHighestEducation: true,
        }
        : null,
      organizationId: assignment?.organizationId ?? null,
      positionId: assignment?.positionId ?? null,
      workplaceName: assignment?.workplaceName ?? null,
      jobLevel: assignment?.jobLevel ?? null,
      employeeLevel: assignment?.employeeLevel ?? null,
      personnelCategory: assignment?.personnelCategory ?? period.personnelCategory,
      workArrangement: assignment?.workArrangement ?? null,
      directManagerEmployeeId: employee.reportingAsEmployee[0]?.managerEmployeeId ?? null,
      employingCompanyId: agreement?.employingCompanyId ?? null,
      agreementType: agreement?.agreementType ?? null,
      contractTermType: agreement ? (agreement.endDate ? 'FIXED' : 'OPEN_ENDED') : null,
      contractEndDate: formatDate(agreement?.endDate),
    };
  }

  async exportOffers(user: AuthenticatedUser, dto: EmployeeExportInput & { query?: { view?: OfferListView } }) {
    const result = await this.findOffers(user, {
      view: dto.query?.view ?? 'PENDING_SEND',
      page: 1,
      pageSize: 10_000,
    } as QueryOffersDto);
    const rows = dto.employeeIds?.length
      ? result.data.filter(({ id }) => dto.employeeIds!.includes(id))
      : result.data;
    return createTableExport(rows, dto.fields, this.offerExportFields(), dto.format, 'Offer管理导出');
  }

  async findOffers(user: AuthenticatedUser, query: QueryOffersDto): Promise<PaginatedOfferList> {
    this.assertDatabaseMode();

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
      workplaceName: true,
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
          workplaceName: row.workplaceName ?? null,
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

  async exportEntries(user: AuthenticatedUser, dto: EmployeeExportInput) {
    const result = await this.findEntries(user, { page: 1, pageSize: 10_000 } as QueryOnboardingListDto);
    const rows = dto.employeeIds?.length ? result.data.filter(({ id }) => dto.employeeIds!.includes(id)) : result.data;
    const fields = this.filterAvailableExportFields(dto.fields, this.entryExportFields());
    return createTableExport(rows, fields, this.entryExportFields(), dto.format, '入职管理导出');
  }

  async findEntries(user: AuthenticatedUser, query: QueryOnboardingListDto): Promise<Paginated<OnboardingEntryListItem>> {
    this.assertDatabaseMode();

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
          workplaceName: true,
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
          name: row.employee.name ?? '--',
          gender: row.employee.gender,
          plannedOrganizationName: row.offer?.organization?.name ?? null,
          plannedEntryDate: row.plannedEntryDate.toISOString().slice(0, 10),
          entryType: null,
          plannedWorkplaceName: row.offer?.workplaceName ?? null,
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

  async exportIntegration(user: AuthenticatedUser, dto: EmployeeExportInput) {
    const result = await this.findIntegration(user, { page: 1, pageSize: 10_000 } as QueryOnboardingListDto);
    const rows = dto.employeeIds?.length ? result.data.filter(({ id }) => dto.employeeIds!.includes(id)) : result.data;
    const fields = this.filterAvailableExportFields(dto.fields, this.integrationExportFields());
    return createTableExport(rows, fields, this.integrationExportFields(), dto.format, '新员工融入导出');
  }

  async findIntegration(user: AuthenticatedUser, query: QueryOnboardingListDto): Promise<Paginated<OnboardingIntegrationListItem>> {
    this.assertDatabaseMode();

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
        employeeName: row.employee.name ?? '--',
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

  async exportIntroduction(user: AuthenticatedUser, dto: EmployeeExportInput) {
    const result = await this.findIntroduction(user, { page: 1, pageSize: 10_000 } as QueryOnboardingListDto);
    const rows = dto.employeeIds?.length ? result.data.filter(({ id }) => dto.employeeIds!.includes(id)) : result.data;
    const fields = this.filterAvailableExportFields(dto.fields, this.introductionExportFields());
    return createTableExport(rows, fields, this.introductionExportFields(), dto.format, '新员工入职介绍导出');
  }

  async findIntroduction(user: AuthenticatedUser, query: QueryOnboardingListDto): Promise<Paginated<EmployeeIntroductionListItem>> {
    this.assertDatabaseMode();

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
        name: row.employee.name ?? '--',
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

  async exportIdCardReader(user: AuthenticatedUser, dto: EmployeeExportInput) {
    const result = await this.findIdCardReader(user, { page: 1, pageSize: 10_000 } as QueryOnboardingListDto);
    const rows = dto.employeeIds?.length ? result.data.filter(({ id }) => dto.employeeIds!.includes(id)) : result.data;
    const fields = this.filterAvailableExportFields(dto.fields, this.idCardExportFields());
    return createTableExport(rows, fields, this.idCardExportFields(), dto.format, '身份证读取导出');
  }

  async findIdCardReader(user: AuthenticatedUser, query: QueryOnboardingListDto): Promise<Paginated<IdCardReadListItem>> {
    this.assertDatabaseMode();

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
          name: row.employee.name ?? '--',
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

  private currentInternPeriodWhere(today: Date): Prisma.EmploymentPeriodWhereInput {
    return {
      status: RecordStatus.ACTIVE,
      archivedAt: null,
      employmentRelationship: EmploymentRelationship.INTERN,
      employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
      actualExitDate: null,
      entryDate: { lte: today },
    };
  }

  private filterAvailableExportFields(requested: string[], available: Array<{ key: string; title: string }>) {
    const keys = new Set(available.map(({ key }) => key));
    return requested.filter((field) => keys.has(field));
  }

  private entryExportFields() {
    return [
      ['name', '姓名'], ['gender', '性别'], ['plannedOrganizationName', '待入职部门'], ['plannedEntryDate', '计划入职日期'],
      ['entryType', '入职类型'], ['plannedWorkplaceName', '计划入职地点'], ['positionName', '职位'], ['jobLevel', '职级'],
      ['managerName', '直线经理'], ['onboardingStatus', '入职状态'], ['preparationStatus', '入职准备状态'],
      ['informationCollectionStatus', '信息采集状态'], ['materialStatus', '入职材料状态'], ['employmentRelationship', '雇佣关系'],
      ['fullTimeCompany', '全日制公司'], ['contractType', '合同类型'], ['effectiveDate', '生效日期'], ['terminationDate', '终止日期'],
      ['dataSource', '数据来源'], ['currentApproverName', '当前审批人'],
    ].map(([key, title]) => ({ key: key!, title: title! }));
  }

  private integrationExportFields() {
    return [
      ['employeeName', '人员'], ['organizationName', '部门'], ['jobTitleName', '职务'], ['entryDate', '入职日期'],
      ['managerName', '直线经理'], ['integrationStatus', '融入状态'], ['integrationProgress', '融入进度'],
    ].map(([key, title]) => ({ key: key!, title: title! }));
  }

  private introductionExportFields() {
    return [
      ['name', '姓名'], ['gender', '性别'], ['organizationName', '部门'], ['positionName', '职位'],
      ['entryDate', '入职日期'], ['introductionStatus', '入职介绍信息状态'],
    ].map(([key, title]) => ({ key: key!, title: title! }));
  }

  private idCardExportFields() {
    return [
      ['name', '姓名'], ['gender', '性别'], ['ethnicity', '民族'], ['birthDate', '出生日期'], ['householdAddress', '户籍所在地'],
      ['documentType', '证件类型'], ['documentNumber', '证件号码'], ['issuingAuthority', '签发机关'], ['issueDate', '证件开始日期'],
      ['expiryDate', '证件截止日期'], ['lastWorkingDate', '最后工作日'], ['previousOrganizationName', '离职前部门'],
      ['terminationType', '离职类型'], ['terminationReason', '离职原因'], ['photo', '照片'], ['recordedBy', '录入人'], ['recordedAt', '录入时间'],
    ].map(([key, title]) => ({ key: key!, title: title! }));
  }

  private offerExportFields() {
    return [
      ['name', '姓名'], ['personalEmail', '个人邮箱'], ['mobile', '手机号码'], ['gender', '性别'],
      ['organizationName', '录用部门'], ['appliedPositionName', '应聘职位'], ['offeredPositionName', '录用职位'],
      ['workplaceName', '工作地点'], ['proposedEntryDate', '拟入职日期'], ['probationMonths', '试用期(月)'],
      ['offerSenderName', 'Offer发送人'], ['issueDate', 'Offer发送日期'], ['recommenderName', '推荐人'],
      ['acceptedAt', '接受Offer日期'], ['syncStatus', '同步状态'], ['rejectedAt', '拒绝offer日期'],
      ['rejectedReason', '拒绝原因备注'], ['entryDate', '入职日期'], ['approvalStatus', '审批状态'],
      ['currentApproverName', '当前审批人'], ['offerStatus', 'offer状态'], ['resumeInfo', '简历信息'],
    ].map(([key, title]) => ({ key: key!, title: title! }));
  }

  private assertDatabaseMode() {
    if (this.demo.enabled) throw new ConflictException('录用入职模块仅支持数据库模式');
  }

  private assertInternOfferMysqlMode() {
    if (this.demo.enabled) throw new ConflictException('新建实习Offer仅支持数据库模式');
  }


  private async validateInternOfferRelations(
    user: AuthenticatedUser,
    dto: CreateInternOfferDto | CreateInternOfferInput,
    accessibleOrganizationIds: string[] | null,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    await this.validateOfferDirectoriesAndManager(
      user,
      dto,
      accessibleOrganizationIds,
      prisma,
      true,
    );
  }

  private async validateOfferDirectoriesAndManager(
    user: AuthenticatedUser,
    input: {
      organizationId?: string;
      positionId?: string;
      workplaceName?: string;
      employingCompanyId?: string;
      directManagerEmployeeId?: string;
    },
    accessibleOrganizationIds: string[] | null,
    prisma: Prisma.TransactionClient | PrismaService,
    requireCoreDirectories: boolean,
  ) {
    if (input.organizationId) {
      if (accessibleOrganizationIds !== null && !accessibleOrganizationIds.includes(input.organizationId)) {
        throw new ForbiddenException('所选部门不在当前账号的数据范围内');
      }
      const organization = await prisma.organization.findFirst({
        where: { id: input.organizationId, status: RecordStatus.ACTIVE, archivedAt: null },
        select: { id: true },
      });
      if (!organization) throw new BadRequestException('录用部门不存在、已停用或已归档');
    } else if (requireCoreDirectories) {
      throw new BadRequestException('必须选择录用部门');
    }

    if (input.positionId) {
      const position = await prisma.position.findFirst({
        where: { id: input.positionId, status: RecordStatus.ACTIVE, archivedAt: null },
        select: { id: true },
      });
      if (!position) throw new BadRequestException('录用职位不存在、已停用或已归档');
    } else if (requireCoreDirectories) {
      throw new BadRequestException('必须选择录用职位');
    }

    if (input.employingCompanyId) {
      const employingCompany = await prisma.employingCompany.findFirst({
        where: { id: input.employingCompanyId, status: RecordStatus.ACTIVE, archivedAt: null },
        select: { id: true },
      });
      if (!employingCompany) throw new BadRequestException('全日制公司不存在、已停用或已归档');
    }

    if (input.directManagerEmployeeId) {
      const managerScope = this.access.hasAllEmployeeData(user)
        ? {}
        : await this.access.getEmployeeWhere(user, accessibleOrganizationIds ?? undefined);
      const manager = await prisma.employee.findFirst({
        where: { id: input.directManagerEmployeeId, ...managerScope },
        select: { id: true },
      });
      if (!manager) throw new BadRequestException('直线上级不存在或不在当前数据范围内');
    }
  }

  private assertOfferContractTerms(
    termType: 'FIXED' | 'OPEN_ENDED' | undefined,
    months: number | undefined,
    endDate: Date | undefined,
    startDate: Date,
  ) {
    if (!termType) {
      if (months || endDate) throw new BadRequestException('未选择合同期限类型时不能填写合同期限或终止日期');
      return;
    }
    if (termType === 'FIXED') {
      if (!months || !endDate) throw new BadRequestException('固定期限合同必须填写合同期限和终止日期');
      this.assertDateAfter(startDate, endDate, '合同终止日期不得早于拟入职日期');
      this.assertMonthDate(startDate, endDate, months, '合同期限与终止日期不一致');
    } else if (months || endDate) {
      throw new BadRequestException('无固定期限合同不能填写合同期限或终止日期');
    }
  }

  private presentCompensationSnapshot(snapshot: {
    salaryPackage: string | null; salaryRemark: string | null; preConfirmationBaseSalary: Prisma.Decimal | null;
    postConfirmationBaseSalary: Prisma.Decimal | null; preConfirmationMonthlyPerformance: Prisma.Decimal | null;
    postConfirmationMonthlyPerformance: Prisma.Decimal | null; preConfirmationMonthlyManagementPerformance: Prisma.Decimal | null;
    postConfirmationMonthlyManagementPerformance: Prisma.Decimal | null; fullTimeContractSalary: Prisma.Decimal | null; annualPerformance: Prisma.Decimal | null;
  }) {
    return {
      salaryPackage: snapshot.salaryPackage,
      salaryRemark: snapshot.salaryRemark,
      preConfirmationBaseSalary: this.decimalString(snapshot.preConfirmationBaseSalary),
      postConfirmationBaseSalary: this.decimalString(snapshot.postConfirmationBaseSalary),
      preConfirmationMonthlyPerformance: this.decimalString(snapshot.preConfirmationMonthlyPerformance),
      postConfirmationMonthlyPerformance: this.decimalString(snapshot.postConfirmationMonthlyPerformance),
      preConfirmationMonthlyManagementPerformance: this.decimalString(snapshot.preConfirmationMonthlyManagementPerformance),
      postConfirmationMonthlyManagementPerformance: this.decimalString(snapshot.postConfirmationMonthlyManagementPerformance),
      fullTimeContractSalary: this.decimalString(snapshot.fullTimeContractSalary),
      annualPerformance: this.decimalString(snapshot.annualPerformance),
    };
  }

  private presentPartTimeSnapshot(snapshot: { positionName: string | null; hourlyRate: Prisma.Decimal | null }) {
    return { positionName: snapshot.positionName, hourlyRate: this.decimalString(snapshot.hourlyRate) };
  }

  private decimalString(value: Prisma.Decimal | null) {
    return value?.toFixed(2) ?? null;
  }

  private utcCalendarDay(value = new Date()) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  private assertDateAfter(startDate: Date, endDate: Date, message: string) {
    if (endDate < startDate) throw new BadRequestException(message);
  }

  private assertMonthDate(startDate: Date, endDate: Date, months: number, message: string) {
    const expected = new Date(startDate);
    expected.setUTCMonth(expected.getUTCMonth() + months);
    if (expected.getUTCFullYear() !== endDate.getUTCFullYear()
      || expected.getUTCMonth() !== endDate.getUTCMonth()
      || expected.getUTCDate() !== endDate.getUTCDate()) {
      throw new BadRequestException(message);
    }
  }

  private async nextInternOfferNo(prisma: Prisma.TransactionClient | PrismaService = this.prisma): Promise<string> {
    const prefix = this.internOfferPrefix(new Date());
    const offers = await prisma.offer.findMany({
      where: { offerNo: { startsWith: prefix } },
      select: { offerNo: true },
    });
    let largestSequence = 0;
    for (const { offerNo } of offers) {
      const sequence = this.internOfferSequence(offerNo, prefix);
      if (sequence !== null) largestSequence = Math.max(largestSequence, sequence);
    }
    if (largestSequence >= 9999) {
      throw new ConflictException('当日实习 Offer 编号已用尽');
    }
    return `${prefix}${String(largestSequence + 1).padStart(4, '0')}`;
  }

  private internOfferPrefix(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${INTERN_OFFER_NUMBER_PREFIX}${year}${month}${day}-`;
  }

  private internOfferSequence(offerNo: string, prefix: string) {
    if (!offerNo.startsWith(prefix)) return null;
    const suffix = offerNo.slice(prefix.length);
    return /^\d{4}$/.test(suffix) ? Number(suffix) : null;
  }

  private isOfferNoUniqueConflict(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
    const target = error.meta?.target;
    const targets = (Array.isArray(target) ? target : [target])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toLowerCase());
    return targets.some((value) => value.includes('offer_no') || value.includes('offerno'));
  }

  private toDate(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
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
