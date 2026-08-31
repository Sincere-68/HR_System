import { ConflictException, Injectable } from '@nestjs/common';
import {
  AgreementStatus,
  AgreementType,
  AssignmentStatus,
  EmploymentStatus,
  Prisma,
  ProcessStatus,
  RecordStatus,
} from '@prisma/client';
import type {
  EmployeeRosterListItem,
  EmployeeRosterListQuery,
  Paginated,
} from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryEmployeeRosterDto } from './dto/query-employee-roster.dto';

@Injectable()
export class EmployeeRosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly demo: DemoDataService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: QueryEmployeeRosterDto | EmployeeRosterListQuery,
  ): Promise<Paginated<EmployeeRosterListItem>> {
    if (this.demo.enabled) {
      throw new ConflictException('员工名册仅支持 MySQL 模式');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const today = this.today();
    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? undefined
      : await this.access.getAccessibleOrganizationIds(user);

    if (!hasAllEmployeeData && (accessibleOrganizationIds ?? []).length === 0) {
      return this.emptyPage(page, pageSize);
    }

    let organizationIds: string[] | undefined;
    if (query.organizationId) {
      organizationIds = await this.access.getOrganizationSubtreeIds(
        query.organizationId,
        hasAllEmployeeData ? undefined : accessibleOrganizationIds ?? [],
      );
      if (organizationIds.length === 0) return this.emptyPage(page, pageSize);
    } else if (!hasAllEmployeeData) {
      organizationIds = accessibleOrganizationIds ?? [];
    }

    const currentAssignment = this.currentAssignmentWhere(today, organizationIds);
    const currentPeriod = this.currentPeriodWhere(today);
    const periodScope: Prisma.EmploymentPeriodWhereInput = organizationIds
      ? { ...currentPeriod, assignments: { some: currentAssignment } }
      : currentPeriod;
    const conditions: Prisma.EmployeeWhereInput[] = [
      { recordStatus: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employmentPeriods: { some: periodScope } },
    ];
    const keyword = query.keyword?.trim();
    if (keyword) {
      conditions.push({
        OR: [
          { employeeNo: { contains: keyword } },
          { name: { contains: keyword } },
        ],
      });
    }
    const where: Prisma.EmployeeWhereInput = { AND: conditions };
    const select = this.rosterSelect(today, periodScope, currentAssignment);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        select,
        orderBy: [{ employeeNo: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);

    const organizationIdsInRows = rows
      .flatMap((row) => row.employmentPeriods[0]?.assignments[0]?.organization.id ?? [])
      .filter((id): id is string => typeof id === 'string');
    const organizations = organizationIdsInRows.length > 0
      ? await this.prisma.organization.findMany({
          select: { id: true, name: true, parentId: true },
        })
      : [];
    const organizationMap = new Map(
      organizations.map((organization) => [organization.id, organization]),
    );

    return {
      data: rows.map((row) => this.toRosterItem(row, today, organizationMap)),
      meta: this.pageMeta(page, pageSize, total),
    };
  }

  private rosterSelect(
    today: Date,
    currentPeriod: Prisma.EmploymentPeriodWhereInput,
    currentAssignment: Prisma.EmployeeAssignmentWhereInput,
  ) {
    return Prisma.validator<Prisma.EmployeeSelect>()({
      id: true,
      name: true,
      workEmail: true,
      employeeNo: true,
      gender: true,
      birthDate: true,
      mobile: true,
      personalEmail: true,
      nativePlace: true,
      householdAddress: true,
      ethnicity: true,
      maritalStatus: true,
      politicalStatus: true,
      educationExperiences: {
        where: { status: RecordStatus.ACTIVE, archivedAt: null },
        orderBy: [{ isHighestEducation: 'desc' }, { graduationDate: 'desc' }, { id: 'asc' }],
        take: 1,
        select: {
          educationLevel: true,
          schoolName: true,
          graduationDate: true,
          major: true,
        },
      },
      identityDocuments: {
        where: { status: RecordStatus.ACTIVE, archivedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        take: 1,
        select: { documentNumber: true },
      },
      familyMembers: {
        where: { status: RecordStatus.ACTIVE, archivedAt: null, isEmergencyContact: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 1,
        select: { name: true, relationship: true, mobile: true },
      },
      reportingAsEmployee: {
        where: {
          status: RecordStatus.ACTIVE,
          archivedAt: null,
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
          isPrimary: true,
          relationshipType: 'ADMINISTRATIVE',
        },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        take: 1,
        select: { manager: { select: { name: true, workEmail: true } } },
      },
      employmentPeriods: {
        where: currentPeriod,
        orderBy: [{ sequenceNo: 'desc' }, { entryDate: 'desc' }, { id: 'asc' }],
        take: 1,
        select: {
          entryDate: true,
          personnelCategory: true,
          employmentRelationship: true,
          employmentStatus: true,
          assignments: {
            where: { ...currentAssignment, isPrimary: true },
            orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
            take: 1,
            select: {
              startDate: true,
              endDate: true,
              organization: { select: { id: true, name: true } },
              jobTitle: { select: { name: true } },
              position: { select: { name: true } },
              jobLevel: true,
              workplace: { select: { name: true } },
              personnelCategory: true,
              employmentRelationship: true,
            },
          },
          probationRecords: {
            where: {
              archivedAt: null,
              status: { notIn: [ProcessStatus.REJECTED, ProcessStatus.WITHDRAWN, ProcessStatus.CANCELLED] },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: 1,
            select: {
              startDate: true,
              plannedEndDate: true,
              probationMonths: true,
              confirmedDate: true,
            },
          },
          agreements: {
            where: {
              status: AgreementStatus.ACTIVE,
              archivedAt: null,
              startDate: { lte: today },
              OR: [{ endDate: null }, { endDate: { gte: today } }],
              AND: [
                { OR: [{ terminationDate: null }, { terminationDate: { gt: today } }] },
                { agreementType: { not: AgreementType.NON_FULL_TIME_EMPLOYMENT_CONTRACT } },
              ],
            },
            orderBy: [
              { startDate: 'desc' },
              { renewalSequence: 'desc' },
              { signingDate: 'desc' },
              { createdAt: 'desc' },
              { id: 'asc' },
            ],
            take: 1,
            select: {
              agreementType: true,
              startDate: true,
              endDate: true,
              terminationDate: true,
              employingCompany: { select: { name: true } },
            },
          },
        },
      },
    });
  }

  private currentPeriodWhere(today: Date): Prisma.EmploymentPeriodWhereInput {
    return {
      status: RecordStatus.ACTIVE,
      archivedAt: null,
      employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
      actualExitDate: null,
      entryDate: { lte: today },
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

  private toRosterItem(
    row: RosterRow,
    today: Date,
    organizations: Map<string, OrganizationNode>,
  ): EmployeeRosterListItem {
    const period = row.employmentPeriods[0];
    const assignment = period?.assignments[0];
    const education = row.educationExperiences[0];
    const identity = row.identityDocuments[0];
    const emergency = row.familyMembers[0];
    const manager = row.reportingAsEmployee[0]?.manager;
    const probation = period?.probationRecords[0];
    const agreement = period?.agreements[0];
    const path = assignment
      ? this.organizationPath(assignment.organization.id, assignment.organization, organizations)
      : [];

    return {
      id: row.id,
      name: row.name,
      workEmail: row.workEmail,
      employeeNo: row.employeeNo,
      gender: row.gender,
      birthDate: formatDate(row.birthDate),
      age: calculateAge(row.birthDate, today),
      highestEducation: education?.educationLevel ?? null,
      graduationSchoolName: education?.schoolName ?? null,
      graduationDate: formatDate(education?.graduationDate ?? null),
      major: education?.major ?? null,
      mobile: row.mobile,
      documentNumber: identity?.documentNumber ?? null,
      personalEmail: row.personalEmail,
      nativePlace: row.nativePlace,
      householdAddress: row.householdAddress,
      householdType: null,
      ethnicity: row.ethnicity,
      maritalStatus: row.maritalStatus,
      politicalStatus: row.politicalStatus,
      partyLeagueJoinDate: null,
      workStartDate: null,
      emergencyContactName: emergency?.name ?? null,
      emergencyContactRelationship: emergency?.relationship ?? null,
      emergencyContactMobile: emergency?.mobile ?? null,
      entryDate: formatDate(period?.entryDate ?? null),
      assignmentStartDate: formatDate(assignment?.startDate ?? null),
      assignmentEndDate: formatDate(assignment?.endDate ?? null),
      departmentName: assignment?.organization.name ?? null,
      jobTitleName: assignment?.jobTitle?.name ?? null,
      positionName: assignment?.position?.name ?? null,
      jobLevel: assignment?.jobLevel ?? null,
      managerName: manager?.name ?? null,
      managerEmail: manager?.workEmail ?? null,
      personnelCategory: assignment?.personnelCategory ?? period?.personnelCategory ?? null,
      serviceYears: calculateServiceYears(period?.entryDate ?? null, today),
      workYears: null,
      workplaceName: assignment?.workplace?.name ?? null,
      employmentRelationship: assignment?.employmentRelationship ?? period?.employmentRelationship ?? null,
      employmentStatus: period?.employmentStatus ?? EmploymentStatus.REGULAR,
      hasProbation: (period?.probationRecords.length ?? 0) > 0,
      probationStartDate: formatDate(probation?.startDate ?? null),
      probationPlannedEndDate: formatDate(probation?.plannedEndDate ?? null),
      probationMonths: probation?.probationMonths ?? null,
      confirmedDate: formatDate(probation?.confirmedDate ?? null),
      lastWorkingDate: null,
      organizationFullName: path.length > 0 ? path.join(' / ') : null,
      level1OrganizationName: path[0] ?? null,
      level2OrganizationName: path[1] ?? null,
      level3OrganizationName: path[2] ?? null,
      agreementType: agreement?.agreementType ?? null,
      fullTimeCompany: agreement?.employingCompany?.name ?? null,
      contractTermType: agreement ? agreement.endDate ? 'FIXED' : 'OPEN_ENDED' : null,
      contractEffectiveDate: formatDate(agreement?.startDate ?? null),
      contractEndDate: formatDate(agreement?.endDate ?? null),
      contractMonths: null,
      actualTerminationDate: formatDate(agreement?.terminationDate ?? null),
    };
  }

  private organizationPath(
    organizationId: string,
    assignedOrganization: { id: string; name: string },
    organizations: Map<string, OrganizationNode>,
  ): string[] {
    const first = organizations.get(organizationId);
    if (!first) return [assignedOrganization.name];

    const path: string[] = [];
    const visited = new Set<string>();
    let current: OrganizationNode | undefined = first;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current.name);
      current = current.parentId ? organizations.get(current.parentId) : undefined;
    }
    return path;
  }

  private today(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  private pageMeta(page: number, pageSize: number, total: number) {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  private emptyPage(page: number, pageSize: number): Paginated<EmployeeRosterListItem> {
    return { data: [], meta: this.pageMeta(page, pageSize, 0) };
  }
}

type OrganizationNode = { id: string; name: string; parentId: string | null };
type RosterRow = Prisma.EmployeeGetPayload<{
  select: ReturnType<EmployeeRosterService['rosterSelect']>;
}>;

function formatDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function calculateAge(birthDate: Date | null, today: Date): number | null {
  if (!birthDate || birthDate > today) return null;
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayPassed = today.getUTCMonth() > birthDate.getUTCMonth()
    || (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() >= birthDate.getUTCDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

function calculateServiceYears(entryDate: Date | null, today: Date): number | null {
  if (!entryDate || entryDate > today) return null;
  const years = (today.getTime() - entryDate.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
  return Math.round(years * 10) / 10;
}
