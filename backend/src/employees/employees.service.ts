import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AgreementStatus,
  AgreementType,
  AssignmentStatus,
  AssignmentType,
  AuditAction,
  EmploymentRelationship,
  EmploymentStatus,
  Prisma,
  ProcessStatus,
  RecordStatus,
  ReportingRelationshipType,
  WorkArrangement,
} from '@prisma/client';
import type { EmployeeFormOptions, EmployeeListItem, Paginated } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService, type DemoEmployeeRecord } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { QueryRegularEmployeesDto } from './dto/query-regular-employees.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { collectFieldChanges, enumValue } from './employee-field-change-log';
import { EMPLOYEE_ENUM_LABELS, employeeEnumLabel } from './employee-field-labels';
import {
  presentDemoEmployeeDetail,
  presentDemoEmployeeListItem,
  presentEmployee,
  presentEmployeeDetail,
  presentEmployeeListItem,
} from './employees.presenter';
import {
  presentRegularEmployee,
  type RegularEmployeeListItem,
  type RegularEmployeeSnapshot,
} from './regular-employees.presenter';

function getEmployeeDetailInclude(now = new Date()) {
  return Prisma.validator<Prisma.EmployeeInclude>()({
    organization: { select: { id: true, name: true } },
  employmentRecords: {
    where: { currentFlag: true },
    select: { status: true },
    take: 1,
  },
  employmentPeriods: {
    where: { status: RecordStatus.ACTIVE, archivedAt: null },
    orderBy: [{ entryDate: 'desc' }, { sequenceNo: 'desc' }, { id: 'asc' }],
    select: {
      personnelCategory: true,
      personnelSource: true,
      employmentRelationship: true,
      entryDate: true,
      actualExitDate: true,
      agreements: {
        where: {
          status: AgreementStatus.ACTIVE,
          archivedAt: null,
          startDate: { lte: now },
          AND: [
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
            { OR: [{ terminationDate: null }, { terminationDate: { gt: now } }] },
          ],
        },
        orderBy: [{ startDate: 'desc' }, { renewalSequence: 'desc' }, { id: 'asc' }],
        take: 1,
        select: { employingCompany: { select: { id: true, code: true, name: true } } },
      },
    },
  },
  reportingAsEmployee: {
    where: {
      status: RecordStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
    include: { manager: { select: { name: true, workEmail: true } } },
  },
  identityDocuments: {
    where: { status: RecordStatus.ACTIVE, archivedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    select: { id: true, documentType: true, documentNumber: true, expiryDate: true, isPrimary: true },
  },
  familyMembers: {
    where: { status: RecordStatus.ACTIVE, archivedAt: null, isEmergencyContact: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, relationship: true, mobile: true, isEmergencyContact: true },
  },
  educationExperiences: {
    where: { status: RecordStatus.ACTIVE, archivedAt: null },
    orderBy: [{ isHighestEducation: 'desc' }, { graduationDate: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      schoolName: true,
      educationLevel: true,
      institutionType: true,
      major: true,
      graduationDate: true,
      isHighestEducation: true,
    },
  },
  workExperiences: {
    where: { status: RecordStatus.ACTIVE, archivedAt: null },
    select: { startDate: true, endDate: true },
  },
  convertedCandidates: { select: { source: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 1 },
  assignments: {
    where: {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
    include: {
      organization: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      workplace: { select: { id: true, name: true } },
    },
  },
});

}

function getEmployeeListInclude(now: Date) {
  return Prisma.validator<Prisma.EmployeeInclude>()({
    organization: { select: { name: true } },
    employmentRecords: {
      where: { currentFlag: true },
      select: { status: true },
      take: 1,
    },
    employmentPeriods: {
      where: { status: RecordStatus.ACTIVE, archivedAt: null },
      orderBy: [{ entryDate: 'desc' as const }, { sequenceNo: 'desc' as const }],
      select: {
        personnelCategory: true,
        personnelSource: true,
        employmentRelationship: true,
        entryDate: true,
        actualExitDate: true,
        agreements: {
          where: {
            status: AgreementStatus.ACTIVE,
            archivedAt: null,
            startDate: { lte: now },
            AND: [
              { OR: [{ endDate: null }, { endDate: { gte: now } }] },
              { OR: [{ terminationDate: null }, { terminationDate: { gt: now } }] },
            ],
          },
          orderBy: [{ startDate: 'desc' }, { renewalSequence: 'desc' }, { id: 'asc' }],
          take: 1,
          select: { employingCompany: { select: { id: true, code: true, name: true } } },
        },
      },
    },
    assignments: {
      where: {
        status: AssignmentStatus.ACTIVE,
        archivedAt: null,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
      include: {
        organization: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
        workplace: { select: { id: true, name: true } },
      },
    },
    reportingAsEmployee: {
      where: {
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
      include: { manager: { select: { name: true, workEmail: true } } },
    },
    identityDocuments: {
      where: { status: RecordStatus.ACTIVE, archivedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      select: { id: true, documentType: true, documentNumber: true, expiryDate: true, isPrimary: true },
    },
    familyMembers: {
      where: { status: RecordStatus.ACTIVE, archivedAt: null, isEmergencyContact: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, relationship: true, mobile: true, isEmergencyContact: true },
    },
    educationExperiences: {
      where: { status: RecordStatus.ACTIVE, archivedAt: null },
      orderBy: [{ isHighestEducation: 'desc' }, { graduationDate: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        schoolName: true,
        educationLevel: true,
        institutionType: true,
        major: true,
        graduationDate: true,
        isHighestEducation: true,
      },
    },
    workExperiences: {
      where: { status: RecordStatus.ACTIVE, archivedAt: null },
      select: { startDate: true, endDate: true },
    },
    convertedCandidates: { select: { source: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 1 },
  });
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly audit: AuditService,
    private readonly demo: DemoDataService,
  ) {}

  async getFormOptions(
    user: AuthenticatedUser,
    options: { excludeEmployeeId?: string } = {},
  ): Promise<EmployeeFormOptions> {
    if (this.demo.enabled) {
      return {
        positions: [],
        workplaces: [],
        managers: [],
        employingCompanies: [],
      };
    }

    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const managerWhere = hasAllEmployeeData
      ? undefined
      : await this.access.getEmployeeWhere(user, accessibleOrganizationIds);
    const [
      positions,
      workplaces,
      managers,
      employingCompanies,
    ] = await this.prisma.$transaction([
      this.prisma.position.findMany({
        where: {
          status: RecordStatus.ACTIVE,
          OR: [
            { organizationId: null },
            ...(hasAllEmployeeData
              ? [{}]
              : [{ organizationId: { in: accessibleOrganizationIds } }]),
          ],
        },
        select: { id: true, name: true, organizationId: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.workplace.findMany({
        where: { status: RecordStatus.ACTIVE },
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.employee.findMany({
        where: {
          ...managerWhere,
          ...(options.excludeEmployeeId ? { id: { not: options.excludeEmployeeId } } : {}),
        },
        select: { id: true, name: true, employeeNo: true },
        orderBy: [{ employeeNo: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.employingCompany.findMany({
        where: {
          status: RecordStatus.ACTIVE,
          archivedAt: null,
        },
        select: { id: true, code: true, name: true },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
    ]);

    return {
      positions,
      workplaces,
      managers,
      employingCompanies,
    };
  }

  async findAll(user: AuthenticatedUser, query: QueryEmployeesDto): Promise<Paginated<EmployeeListItem>> {
    if (this.demo.enabled) return this.findAllInDemo(user, query) as Paginated<EmployeeListItem>;

    const now = new Date();
    const visibleOrganizationIds = this.access.hasAllEmployeeData(user)
      ? undefined
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    const currentAssignmentWhere: Prisma.EmployeeAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    };
    const conditions: Prisma.EmployeeWhereInput[] = [];
    if (!this.access.hasAllEmployeeData(user)) {
      const accessibleOrganizationIds = (await this.access.getAccessibleOrganizationIds(user)) ?? [];
      conditions.push(await this.access.getEmployeeWhere(user, accessibleOrganizationIds, now));
    }

    if (query.organizationId) {
      if (!(await this.access.canAccessOrganizationInScope(user, query.organizationId))) {
        conditions.push({ id: { in: [] } });
      } else {
        conditions.push({
          OR: [
            {
              assignments: {
                some: {
                  ...currentAssignmentWhere,
                  organizationId: query.organizationId,
                },
              },
            },
            {
              assignments: { none: {} },
              organizationId: query.organizationId,
            },
          ],
        });
      }
    }
    if (query.keyword) {
      conditions.push({
        OR: [
          { name: { contains: query.keyword } },
          { employeeNo: { contains: query.keyword } },
        ],
      });
    }
    if (query.status) {
      conditions.push({
        employmentRecords: { some: { status: query.status, currentFlag: true } },
      });
    }

    const where: Prisma.EmployeeWhereInput = { AND: conditions };
    const page = query.page;
    const pageSize = query.pageSize;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: getEmployeeListInclude(now),
        orderBy: [{ employeeNo: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: rows.map((employee) => presentEmployeeListItem(employee, now, visibleOrganizationIds)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Read-only MySQL view for current regular employees. A row is rooted at an
   * active employee and its current active REGULAR employment period, which
   * must have one current primary assignment in the authorized organization
   * scope. Demo data intentionally has no equivalent relational snapshot.
   */
  async findRegularEmployees(
    user: AuthenticatedUser,
    query: QueryRegularEmployeesDto,
  ): Promise<Paginated<RegularEmployeeListItem>> {
    const page = query.page;
    const pageSize = query.pageSize;
    if (this.demo.enabled) return this.emptyRegularEmployeesPage(page, pageSize);

    const today = this.utcCalendarDay();
    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? []
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    if (!hasAllEmployeeData && accessibleOrganizationIds.length === 0) {
      return this.emptyRegularEmployeesPage(page, pageSize);
    }

    let displayedOrganizationIds: string[] | undefined;
    if (query.organizationId) {
      displayedOrganizationIds = await this.access.getOrganizationSubtreeIds(
        query.organizationId,
        hasAllEmployeeData ? undefined : accessibleOrganizationIds,
      );
      if (displayedOrganizationIds.length === 0) {
        return this.emptyRegularEmployeesPage(page, pageSize);
      }
    } else if (!hasAllEmployeeData) {
      displayedOrganizationIds = accessibleOrganizationIds;
    }

    const primaryAssignmentWhere: Prisma.EmployeeAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      isPrimary: true,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
      ...(displayedOrganizationIds ? { organizationId: { in: displayedOrganizationIds } } : {}),
    };
    const currentRegularPeriodWhere: Prisma.EmploymentPeriodWhereInput = {
      status: RecordStatus.ACTIVE,
      archivedAt: null,
      employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
      employmentStatus: EmploymentStatus.REGULAR,
      actualExitDate: null,
      entryDate: { lte: today },
      assignments: { some: primaryAssignmentWhere },
    };
    const conditions: Prisma.EmployeeWhereInput[] = [
      { recordStatus: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employmentPeriods: { some: currentRegularPeriodWhere } },
    ];
    if (query.keyword) {
      conditions.push({
        OR: [
          { name: { contains: query.keyword } },
          { employeeNo: { contains: query.keyword } },
        ],
      });
    }
    const where: Prisma.EmployeeWhereInput = { AND: conditions };
    const select = this.regularEmployeeSelect(today, currentRegularPeriodWhere, primaryAssignmentWhere);
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

    const detailEmployeeIds = await this.getRegularEmployeeDetailIds(
      user,
      rows.map(({ id }) => id),
      today,
    );
    return {
      data: rows.map((row) => presentRegularEmployee(row, detailEmployeeIds.has(row.id))),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(user: AuthenticatedUser, id: string, auditContext: AuditContext) {
    if (this.demo.enabled) {
      const employee = this.findAccessibleDemoEmployee(user, id);
      await this.audit.create(auditContext, AuditAction.DETAIL_VIEW, id);
      return presentDemoEmployeeDetail(employee);
    }

    const employee = await this.findAccessibleEmployee(user, id);
    await this.audit.create(auditContext, AuditAction.DETAIL_VIEW, id);
    const visibleOrganizationIds = this.access.hasAllEmployeeData(user)
      ? undefined
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    return presentEmployeeDetail(employee, new Date(), visibleOrganizationIds);
  }

  async create(user: AuthenticatedUser, dto: CreateEmployeeDto, auditContext: AuditContext) {
    await this.access.assertOrganizationAccess(user, dto.organizationId);
    if (this.demo.enabled) {
      throw new ConflictException('完整新增人员仅支持 MySQL 模式');
    }

    await this.validateCreateRelations(user, dto);
    const entryDate = this.toDate(dto.entryDate);
    const probationEndDate = dto.probationEndDate ? this.toDate(dto.probationEndDate) : undefined;
    const contractEndDate = dto.contractEndDate ? this.toDate(dto.contractEndDate) : undefined;
    if (dto.hasProbation) {
      if (!dto.probationMonths || !probationEndDate) {
        throw new BadRequestException('有试用期时必须填写试用期月数和预计结束日期');
      }
      this.assertDateAfter(entryDate, probationEndDate, '预计试用结束日期不得早于入职日期');
      this.assertMonthDate(entryDate, probationEndDate, dto.probationMonths, '试用期月数与预计结束日期不一致');
    } else if (dto.probationMonths || dto.probationEndDate) {
      throw new BadRequestException('无试用期时不能填写试用期信息');
    }
    if (dto.contractTermType === 'FIXED') {
      if (!dto.contractMonths || !contractEndDate) {
        throw new BadRequestException('固定期限合同必须填写合同期限和终止日期');
      }
      this.assertDateAfter(entryDate, contractEndDate, '合同终止日期不得早于入职日期');
      this.assertMonthDate(entryDate, contractEndDate, dto.contractMonths, '合同期限与终止日期不一致');
    } else if (dto.contractTermType === 'OPEN_ENDED') {
      if (dto.contractMonths || dto.contractEndDate) {
        throw new BadRequestException('无固定期限合同不能填写合同期限或终止日期');
      }
    } else {
      throw new BadRequestException('新增人员时必须选择合同期限类型');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const documentNumber = dto.documentNumber.toUpperCase();
        const legacyIdCardNo = dto.documentType === 'NATIONAL_ID' ? documentNumber : undefined;
        const employee = await tx.employee.create({
          data: {
            employeeNo: dto.employeeNo,
            name: dto.name,
            mobile: dto.mobile,
            workEmail: dto.workEmail,
            personalEmail: dto.personalEmail,
            gender: dto.gender,
            birthDate: this.toDate(dto.birthDate),
            ethnicity: dto.ethnicity,
            maritalStatus: dto.maritalStatus,
            politicalStatus: dto.politicalStatus,
            householdType: dto.householdType,
            householdAddress: dto.householdAddress,
            residentialAddress: dto.residentialAddress,
            bankName: dto.bankName,
            bankBranchName: dto.bankBranchName,
            bankAccountNumber: dto.bankAccountNumber,
            idCardNo: legacyIdCardNo,
            organizationId: dto.organizationId,
          },
        });
        const employmentPeriod = await tx.employmentPeriod.create({
          data: {
            employeeId: employee.id,
            sequenceNo: 1,
            personnelCategory: dto.personnelCategory,
            personnelSource: dto.personnelSource,
            employmentRelationship: dto.employmentRelationship,
            entryDate,
            employmentStatus: dto.employmentStatus,
            isRehire: false,
            status: RecordStatus.ACTIVE,
          },
        });
        await tx.employeeAssignment.create({
          data: {
            employeeId: employee.id,
            employmentPeriodId: employmentPeriod.id,
            organizationId: dto.organizationId,
            positionId: dto.positionId,
            jobLevel: dto.jobLevel,
            workplaceId: dto.workplaceId,
            personnelPosition: dto.personnelPosition,
            employeeLevel: dto.employeeLevel,
            personnelCategory: dto.personnelCategory,
            personnelSource: dto.personnelSource,
            employmentRelationship: dto.employmentRelationship,
            assignmentType: AssignmentType.PRIMARY,
            workArrangement: dto.workArrangement,
            isPrimary: true,
            startDate: entryDate,
            status: AssignmentStatus.ACTIVE,
          },
        });
        await tx.employeeIdentityDocument.create({
          data: {
            employeeId: employee.id,
            documentType: dto.documentType,
            documentNumber,
            isPrimary: true,
            expiryDate: this.toDate(dto.documentExpiryDate),
            status: RecordStatus.ACTIVE,
          },
        });
        await tx.employeeFamilyMember.create({
          data: {
            employeeId: employee.id,
            name: dto.emergencyContactName,
            relationship: dto.emergencyContactRelationship,
            mobile: dto.emergencyContactMobile,
            isEmergencyContact: true,
            status: RecordStatus.ACTIVE,
          },
        });
        await tx.employeeEducationExperience.create({
          data: {
            employeeId: employee.id,
            schoolName: dto.graduationSchoolName,
            educationLevel: dto.highestEducation,
            institutionType: dto.institutionType,
            graduationDate: this.toDate(dto.graduationDate),
            major: dto.major,
            isHighestEducation: true,
            status: RecordStatus.ACTIVE,
          },
        });
        await tx.employmentRecord.create({
          data: {
            employeeId: employee.id,
            employmentPeriodId: employmentPeriod.id,
            status: dto.employmentStatus,
            effectiveAt: entryDate,
            currentFlag: true,
          },
        });
        if (dto.hasProbation && probationEndDate) {
          await tx.probationRecord.create({
            data: {
              employeeId: employee.id,
              employmentPeriodId: employmentPeriod.id,
              startDate: entryDate,
              plannedEndDate: probationEndDate,
              probationMonths: dto.probationMonths,
              status: ProcessStatus.IN_PROGRESS,
            },
          });
        }
        if (dto.managerEmployeeId) {
          if (dto.managerEmployeeId === employee.id) {
            throw new BadRequestException('员工不能将自己设为直接经理');
          }
          await tx.reportingRelationship.create({
            data: {
              employeeId: employee.id,
              managerEmployeeId: dto.managerEmployeeId,
              relationshipType: ReportingRelationshipType.ADMINISTRATIVE,
              isPrimary: true,
              startDate: entryDate,
              status: RecordStatus.ACTIVE,
            },
          });
        }
        await tx.employeeAgreement.create({
          data: {
            employeeId: employee.id,
            employmentPeriodId: employmentPeriod.id,
            agreementNo: `${dto.employeeNo}-P1`,
            agreementType: this.getAgreementType(dto.employmentRelationship),
            employingCompanyId: dto.agreementEmployingCompanyId,
            signingDate: entryDate,
            startDate: entryDate,
            endDate: contractEndDate,
            probationEndDate,
            status: AgreementStatus.ACTIVE,
          },
        });
        await this.audit.create(
          auditContext,
          AuditAction.CREATE,
          employee.id,
          {
            changedFields: [
              'employeeNo',
              'name',
              'workEmail',
              'personalEmail',
              'gender',
              'birthDate',
              'ethnicity',
              'maritalStatus',
              'politicalStatus',
              'householdType',
              'householdAddress',
              'residentialAddress',
              'bankName',
              'bankBranchName',
              'bankAccountNumber',
              'personnelCategory',
              'employmentRelationship',
              'personnelSource',
              'workArrangement',
              'personnelPosition',
              'employeeLevel',
              'agreementEmployingCompanyId',
              'mobile',
              'documentType',
              'documentNumber',
              'entryDate',
              'organizationId',
              'positionId',
              'jobLevel',
              'workplaceId',
              'hasProbation',
              'probationMonths',
              'probationEndDate',
              'managerEmployeeId',
              'contractTermType',
              'contractMonths',
              'contractEndDate',
              'employmentStatus',
            ],
          },
          tx,
        );
        const created = await tx.employee.findUniqueOrThrow({
          where: { id: employee.id },
          include: getEmployeeDetailInclude(),
        });
        return presentEmployeeDetail(created, new Date());
      });
    } catch (error) {
      this.handleUniqueConflict(error);
    }
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateEmployeeDto,
    auditContext: AuditContext,
  ) {
    const current = this.demo.enabled
      ? this.findAccessibleDemoEmployee(user, id)
      : await this.findAccessibleEmployee(user, id);
    const changedFields = Object.keys(dto);
    if (changedFields.length === 0) {
      if (this.demo.enabled) return presentDemoEmployeeDetail(current as DemoEmployeeRecord);
      const visibleOrganizationIds = this.access.hasAllEmployeeData(user)
        ? undefined
        : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
      return presentEmployeeDetail(current as Parameters<typeof presentEmployeeDetail>[0], new Date(), visibleOrganizationIds);
    }

    if (this.demo.enabled) {
      const employee = this.demo.updateEmployee(current as DemoEmployeeRecord, dto);
      await this.audit.create(auditContext, AuditAction.UPDATE, id, { changedFields });
      return presentDemoEmployeeDetail(employee);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentAssignment = await tx.employeeAssignment.findFirst({
          where: { employeeId: id, isPrimary: true, status: AssignmentStatus.ACTIVE, archivedAt: null },
          orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            personnelPosition: true,
            employeeLevel: true,
            personnelCategory: true,
            employmentRelationship: true,
            personnelSource: true,
            workArrangement: true,
          },
        });
        const currentDocument = await tx.employeeIdentityDocument.findFirst({
          where: { employeeId: id, isPrimary: true, status: RecordStatus.ACTIVE, archivedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          select: { id: true, documentType: true, documentNumber: true, expiryDate: true },
        });
        const currentContact = await tx.employeeFamilyMember.findFirst({
          where: { employeeId: id, isEmergencyContact: true, status: RecordStatus.ACTIVE, archivedAt: null },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true, relationship: true, mobile: true },
        });
        const currentEducation = await tx.employeeEducationExperience.findFirst({
          where: { employeeId: id, isHighestEducation: true, status: RecordStatus.ACTIVE, archivedAt: null },
          orderBy: [{ graduationDate: 'desc' }, { id: 'asc' }],
          select: { id: true, schoolName: true, institutionType: true, educationLevel: true, graduationDate: true, major: true },
        });

        const documentFields = ['documentType', 'documentNumber', 'documentExpiryDate'] as const;
        const changesDocument = documentFields.some((field) => dto[field] !== undefined);
        let updatedDocumentType = currentDocument?.documentType;
        let updatedDocumentNumber = currentDocument?.documentNumber;
        let legacyIdCardNo: string | null | undefined;
        if (changesDocument) {
          if (!currentDocument && (!dto.documentType || !dto.documentNumber)) {
            throw new BadRequestException('新增主要证件时必须同时填写证件类型和证件号码');
          }
          if (
            currentDocument
            && dto.documentType !== undefined
            && dto.documentType !== currentDocument.documentType
            && dto.documentNumber === undefined
          ) {
            throw new BadRequestException('切换证件类型时必须同时填写证件号码');
          }
          updatedDocumentType = dto.documentType ?? currentDocument?.documentType;
          updatedDocumentNumber = dto.documentNumber !== undefined
            ? dto.documentNumber.toUpperCase()
            : currentDocument?.documentNumber;
          if (!updatedDocumentType || !updatedDocumentNumber) {
            throw new BadRequestException('主要证件必须同时填写证件类型和证件号码');
          }
          legacyIdCardNo = updatedDocumentType === 'NATIONAL_ID' ? updatedDocumentNumber : null;
        }

        const profileFields = [
          'employeeNo',
          'name',
          'workEmail',
          'personalEmail',
          'mobile',
          'gender',
          'birthDate',
          'ethnicity',
          'maritalStatus',
          'politicalStatus',
          'nativePlace',
          'householdType',
          'householdAddress',
          'residentialAddress',
          'bankName',
          'bankBranchName',
          'bankAccountNumber',
        ] as const;
        const profileChanges = collectFieldChanges(
          dto as Record<string, unknown>,
          current as unknown as Record<string, unknown>,
        ).filter(({ field }) => profileFields.includes(field as (typeof profileFields)[number]));
        await tx.employee.update({
          where: { id },
          data: {
            employeeNo: dto.employeeNo, name: dto.name, workEmail: dto.workEmail, personalEmail: dto.personalEmail,
            mobile: dto.mobile, gender: dto.gender, birthDate: dto.birthDate ? this.toDate(dto.birthDate) : undefined,
            ethnicity: dto.ethnicity, maritalStatus: dto.maritalStatus, politicalStatus: dto.politicalStatus,
            nativePlace: dto.nativePlace, householdType: dto.householdType, householdAddress: dto.householdAddress,
            residentialAddress: dto.residentialAddress, bankName: dto.bankName, bankBranchName: dto.bankBranchName,
            bankAccountNumber: dto.bankAccountNumber,
            idCardNo: changesDocument ? legacyIdCardNo : undefined,
          },
        });
        for (const change of profileChanges) {
          await tx.employeeFieldChangeLog.create({
            data: {
              employeeId: id,
              changedField: change.field,
              oldValue: EMPLOYEE_ENUM_LABELS[change.field]
                ? enumValue(
                  current[change.field as keyof typeof current] as string | null | undefined,
                  employeeEnumLabel(
                    change.field,
                    current[change.field as keyof typeof current] as string | null | undefined,
                  ),
                ) ?? undefined
                : change.oldValue ?? undefined,
              newValue: EMPLOYEE_ENUM_LABELS[change.field]
                ? enumValue(
                  dto[change.field as keyof UpdateEmployeeDto] as string | null | undefined,
                  employeeEnumLabel(
                    change.field,
                    dto[change.field as keyof UpdateEmployeeDto] as string | null | undefined,
                  ),
                ) ?? undefined
                : change.newValue ?? undefined,
              changedById: auditContext.userId,
            },
          });
        }

        const assignmentFields = ['personnelPosition', 'employeeLevel', 'personnelCategory', 'employmentRelationship', 'personnelSource', 'workArrangement'] as const;
        const changesCurrentAssignment = assignmentFields.some((field) => dto[field] !== undefined);
        if (changesCurrentAssignment && !currentAssignment) {
          throw new BadRequestException('当前员工没有可更新的主要任职记录');
        }
        if (currentAssignment && changesCurrentAssignment) {
          const assignmentData = {
            personnelPosition: dto.personnelPosition ?? currentAssignment.personnelPosition,
            employeeLevel: dto.employeeLevel ?? currentAssignment.employeeLevel,
            personnelCategory: dto.personnelCategory ?? currentAssignment.personnelCategory,
            employmentRelationship: dto.employmentRelationship ?? currentAssignment.employmentRelationship,
            personnelSource: dto.personnelSource ?? currentAssignment.personnelSource,
            workArrangement: dto.workArrangement ?? currentAssignment.workArrangement,
          };
          const changes = collectFieldChanges(dto as Record<string, unknown>, currentAssignment as unknown as Record<string, unknown>);
          const assignmentChanges = this.createAssignmentChangeSnapshots(currentAssignment, dto);
          await tx.employeeAssignment.update({ where: { id: currentAssignment.id }, data: assignmentData });
          for (const change of changes.filter(({ field }) => assignmentFields.includes(field as never))) {
            const snapshot = assignmentChanges.get(change.field);
            await tx.employeeFieldChangeLog.create({
              data: {
                employeeId: id,
                assignmentId: currentAssignment.id,
                changedField: change.field,
                oldValue: snapshot?.oldValue ?? change.oldValue ?? undefined,
                newValue: snapshot?.newValue ?? change.newValue ?? undefined,
                changedById: auditContext.userId,
              },
            });
          }
        }
        if (changesDocument) {
          if (currentDocument) {
            const changes = collectFieldChanges(
              {
                documentType: updatedDocumentType,
                documentNumber: updatedDocumentNumber,
                documentExpiryDate: dto.documentExpiryDate,
              },
              {
                documentType: currentDocument.documentType,
                documentNumber: currentDocument.documentNumber,
                documentExpiryDate: currentDocument.expiryDate,
              },
            );
            await tx.employeeIdentityDocument.update({
              where: { id: currentDocument.id },
              data: {
                documentType: updatedDocumentType,
                documentNumber: updatedDocumentNumber,
                expiryDate: dto.documentExpiryDate ? this.toDate(dto.documentExpiryDate) : currentDocument.expiryDate,
              },
            });
            for (const change of changes) {
              await tx.employeeFieldChangeLog.create({
                data: {
                  employeeId: id,
                  changedField: change.field,
                  oldValue: change.field === 'documentType'
                    ? enumValue(
                      currentDocument.documentType,
                      employeeEnumLabel('documentType', currentDocument.documentType),
                    ) ?? undefined
                    : change.oldValue ?? undefined,
                  newValue: change.field === 'documentType'
                    ? enumValue(
                      updatedDocumentType,
                      employeeEnumLabel('documentType', updatedDocumentType),
                    ) ?? undefined
                    : change.newValue ?? undefined,
                  changedById: auditContext.userId,
                },
              });
            }
          } else {
            await tx.employeeIdentityDocument.create({
              data: {
                employeeId: id,
                documentType: updatedDocumentType!,
                documentNumber: updatedDocumentNumber!,
                expiryDate: dto.documentExpiryDate ? this.toDate(dto.documentExpiryDate) : undefined,
                isPrimary: true,
                status: RecordStatus.ACTIVE,
              },
            });
            await tx.employeeFieldChangeLog.create({
              data: {
                employeeId: id,
                changedField: 'documentType',
                newValue: enumValue(
                  updatedDocumentType,
                  employeeEnumLabel('documentType', updatedDocumentType),
                ) ?? undefined,
                changedById: auditContext.userId,
              },
            });
            await tx.employeeFieldChangeLog.create({
              data: {
                employeeId: id,
                changedField: 'documentNumber',
                newValue: updatedDocumentNumber!,
                changedById: auditContext.userId,
              },
            });
            if (dto.documentExpiryDate !== undefined) {
              await tx.employeeFieldChangeLog.create({
                data: {
                  employeeId: id,
                  changedField: 'documentExpiryDate',
                  newValue: dto.documentExpiryDate,
                  changedById: auditContext.userId,
                },
              });
            }
          }
        }
        const contactFields = ['emergencyContactName', 'emergencyContactRelationship', 'emergencyContactMobile'] as const;
        if (contactFields.some((field) => dto[field] !== undefined)) {
          if (currentContact) {
            const changes = collectFieldChanges(
              {
                emergencyContactName: dto.emergencyContactName,
                emergencyContactRelationship: dto.emergencyContactRelationship,
                emergencyContactMobile: dto.emergencyContactMobile,
              },
              {
                emergencyContactName: currentContact.name,
                emergencyContactRelationship: currentContact.relationship,
                emergencyContactMobile: currentContact.mobile,
              },
            );
            await tx.employeeFamilyMember.update({
              where: { id: currentContact.id },
              data: {
                name: dto.emergencyContactName ?? currentContact.name,
                relationship: dto.emergencyContactRelationship ?? currentContact.relationship,
                mobile: dto.emergencyContactMobile ?? currentContact.mobile,
              },
            });
            for (const change of changes) {
              await tx.employeeFieldChangeLog.create({
                data: {
                  employeeId: id,
                  changedField: change.field,
                  oldValue: change.oldValue ?? undefined,
                  newValue: change.newValue ?? undefined,
                  changedById: auditContext.userId,
                },
              });
            }
          } else if (dto.emergencyContactName && dto.emergencyContactRelationship && dto.emergencyContactMobile) {
            await tx.employeeFamilyMember.create({
              data: {
                employeeId: id,
                name: dto.emergencyContactName,
                relationship: dto.emergencyContactRelationship,
                mobile: dto.emergencyContactMobile,
                isEmergencyContact: true,
                status: RecordStatus.ACTIVE,
              },
            });
            for (const [changedField, newValue] of [
              ['emergencyContactName', dto.emergencyContactName],
              ['emergencyContactRelationship', dto.emergencyContactRelationship],
              ['emergencyContactMobile', dto.emergencyContactMobile],
            ] as const) {
              await tx.employeeFieldChangeLog.create({
                data: { employeeId: id, changedField, newValue, changedById: auditContext.userId },
              });
            }
          } else {
            throw new BadRequestException('新增紧急联系人时必须同时填写姓名、关系和电话');
          }
        }
        const educationFields = ['graduationSchoolName', 'institutionType', 'highestEducation', 'graduationDate', 'major'] as const;
        if (educationFields.some((field) => dto[field] !== undefined)) {
          if (currentEducation) {
            const changes = collectFieldChanges({ graduationSchoolName: dto.graduationSchoolName, institutionType: dto.institutionType, highestEducation: dto.highestEducation, graduationDate: dto.graduationDate, major: dto.major }, { graduationSchoolName: currentEducation.schoolName, institutionType: currentEducation.institutionType, highestEducation: currentEducation.educationLevel, graduationDate: currentEducation.graduationDate, major: currentEducation.major });
            await tx.employeeEducationExperience.update({
              where: { id: currentEducation.id },
              data: {
                schoolName: dto.graduationSchoolName ?? currentEducation.schoolName,
                institutionType: dto.institutionType ?? currentEducation.institutionType,
                educationLevel: dto.highestEducation ?? currentEducation.educationLevel,
                graduationDate: dto.graduationDate ? this.toDate(dto.graduationDate) : currentEducation.graduationDate,
                major: dto.major ?? currentEducation.major,
              },
            });
            for (const change of changes) {
              const isEnum = Boolean(EMPLOYEE_ENUM_LABELS[change.field]);
              const oldCode = change.field === 'institutionType'
                ? currentEducation.institutionType
                : change.field === 'highestEducation'
                  ? currentEducation.educationLevel
                  : null;
              const newCode = change.field === 'institutionType'
                ? dto.institutionType
                : change.field === 'highestEducation'
                  ? dto.highestEducation
                  : null;
              await tx.employeeFieldChangeLog.create({
                data: {
                  employeeId: id,
                  changedField: change.field,
                  oldValue: isEnum
                    ? enumValue(oldCode, employeeEnumLabel(change.field, oldCode)) ?? undefined
                    : change.oldValue ?? undefined,
                  newValue: isEnum
                    ? enumValue(newCode, employeeEnumLabel(change.field, newCode)) ?? undefined
                    : change.newValue ?? undefined,
                  changedById: auditContext.userId,
                },
              });
            }
          } else if (dto.graduationSchoolName && dto.institutionType && dto.highestEducation && dto.graduationDate && dto.major) {
            await tx.employeeEducationExperience.create({
              data: {
                employeeId: id,
                schoolName: dto.graduationSchoolName,
                institutionType: dto.institutionType,
                educationLevel: dto.highestEducation,
                graduationDate: this.toDate(dto.graduationDate),
                major: dto.major,
                isHighestEducation: true,
                status: RecordStatus.ACTIVE,
              },
            });
            const newEducationValues = [
              ['graduationSchoolName', dto.graduationSchoolName],
              ['institutionType', enumValue(dto.institutionType, employeeEnumLabel('institutionType', dto.institutionType))],
              ['highestEducation', enumValue(dto.highestEducation, employeeEnumLabel('highestEducation', dto.highestEducation))],
              ['graduationDate', dto.graduationDate],
              ['major', dto.major],
            ] as const;
            for (const [changedField, newValue] of newEducationValues) {
              await tx.employeeFieldChangeLog.create({
                data: {
                  employeeId: id,
                  changedField,
                  newValue: newValue ?? undefined,
                  changedById: auditContext.userId,
                },
              });
            }
          } else {
            throw new BadRequestException('新增最高教育时必须填写学校、院校类型、学历、毕业时间和专业');
          }
        }
        await this.audit.create(auditContext, AuditAction.UPDATE, id, { changedFields }, tx);
        const updated = await tx.employee.findUniqueOrThrow({ where: { id }, include: getEmployeeDetailInclude() });
        return presentEmployeeDetail(updated, new Date());
      });
    } catch (error) {
      this.handleUniqueConflict(error);
    }
  }

  private regularEmployeeSelect(
    today: Date,
    currentRegularPeriodWhere: Prisma.EmploymentPeriodWhereInput,
    primaryAssignmentWhere: Prisma.EmployeeAssignmentWhereInput,
  ) {
    return Prisma.validator<Prisma.EmployeeSelect>()({
      id: true,
      name: true,
      employeeNo: true,
      gender: true,
      workEmail: true,
      bankName: true,
      bankAccountNumber: true,
      bankBranchName: true,
      employmentPeriods: {
        where: currentRegularPeriodWhere,
        orderBy: [{ sequenceNo: 'desc' }, { entryDate: 'desc' }, { id: 'asc' }],
        take: 1,
        select: {
          entryDate: true,
          assignments: {
            where: primaryAssignmentWhere,
            orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
            take: 1,
            select: {
              organization: { select: { name: true } },
              position: { select: { name: true } },
              jobLevel: true,
              workArrangement: true,
            },
          },
          agreements: {
            where: {
              status: AgreementStatus.ACTIVE,
              archivedAt: null,
              startDate: { lte: today },
              OR: [{ endDate: null }, { endDate: { gte: today } }],
              AND: [{ OR: [{ terminationDate: null }, { terminationDate: { gt: today } }] }],
            },
            orderBy: [
              { startDate: 'desc' },
              { renewalSequence: 'desc' },
              { signingDate: 'desc' },
              { createdAt: 'desc' },
              { id: 'asc' },
            ],
            take: 1,
            select: { employingCompany: { select: { name: true } } },
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
        select: { manager: { select: { name: true } } },
      },
    });
  }

  private async getRegularEmployeeDetailIds(
    user: AuthenticatedUser,
    employeeIds: string[],
    today: Date,
  ): Promise<Set<string>> {
    if (employeeIds.length === 0) return new Set();
    if (this.access.hasAllEmployeeData(user)) return new Set(employeeIds);

    const detailWhere = await this.access.getEmployeeWhere(user, undefined, today);
    const rows = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds }, ...detailWhere },
      select: { id: true },
    });
    return new Set(rows.map(({ id }) => id));
  }

  private utcCalendarDay(value = new Date()) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  private emptyRegularEmployeesPage(
    page: number,
    pageSize: number,
  ): Paginated<RegularEmployeeListItem> {
    return { data: [], meta: { page, pageSize, total: 0, totalPages: 0 } };
  }

  private findAllInDemo(
    user: AuthenticatedUser,
    query: QueryEmployeesDto,
  ): Paginated<ReturnType<typeof presentEmployee>> {
    let employees = this.demo.getEmployees().filter(
      (employee) => this.access.hasAllEmployeeData(user) || user.organizationIds.includes(employee.organizationId),
    );
    if (query.organizationId) {
      employees = this.access.canAccessOrganization(user, query.organizationId)
        ? employees.filter((employee) => employee.organizationId === query.organizationId)
        : [];
    }
    if (query.keyword) {
      const keyword = query.keyword.toLocaleLowerCase();
      employees = employees.filter(
        (employee) => employee.name.toLocaleLowerCase().includes(keyword)
          || employee.employeeNo.toLocaleLowerCase().includes(keyword),
      );
    }
    if (query.status) {
      employees = employees.filter((employee) => employee.employmentRecords[0]?.status === query.status);
    }
    employees.sort((first, second) => first.employeeNo.localeCompare(second.employeeNo) || first.id.localeCompare(second.id));

    const total = employees.length;
    const start = (query.page - 1) * query.pageSize;
    return {
      data: employees.slice(start, start + query.pageSize).map((employee) => presentDemoEmployeeListItem(employee)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  private findAccessibleDemoEmployee(user: AuthenticatedUser, id: string) {
    const employee = this.demo.getEmployee(id);
    if (!employee || !this.access.canAccessOrganization(user, employee.organizationId)) {
      throw new NotFoundException('员工不存在或不在当前数据范围内');
    }
    return employee;
  }

  private async findAccessibleEmployee(user: AuthenticatedUser, id: string) {
    const employeeWhere = await this.access.getEmployeeWhere(user);
    const employee = await this.prisma.employee.findFirst({
      where: { id, ...employeeWhere },
      include: getEmployeeDetailInclude(),
    });
    if (!employee) throw new NotFoundException('员工不存在或不在当前数据范围内');
    return employee;
  }

  private async validateCreateRelations(user: AuthenticatedUser, dto: CreateEmployeeDto) {
    const checks: Promise<number>[] = [];
    const labels: string[] = [];
    checks.push(this.prisma.employingCompany.count({ where: { id: dto.agreementEmployingCompanyId, status: RecordStatus.ACTIVE, archivedAt: null } }));
    labels.push('全日制公司不存在或已停用');
    if (dto.positionId) {
      checks.push(this.prisma.position.count({
        where: {
          id: dto.positionId,
          status: RecordStatus.ACTIVE,
          OR: [{ organizationId: null }, { organizationId: dto.organizationId }],
        },
      }));
      labels.push('职位不存在、已停用或不属于所选部门');
    }
    if (dto.workplaceId) {
      checks.push(this.prisma.workplace.count({ where: { id: dto.workplaceId, status: RecordStatus.ACTIVE } }));
      labels.push('工作地点不存在或已停用');
    }
    if (dto.managerEmployeeId) {
      checks.push(this.prisma.employee.count({
        where: { id: dto.managerEmployeeId },
      }));
      labels.push('直接经理不存在');
    }
    const results = await Promise.all(checks);
    const invalidIndex = results.findIndex((count) => count === 0);
    if (invalidIndex >= 0) throw new BadRequestException(labels[invalidIndex]);
  }

  private createAssignmentChangeSnapshots(
    currentAssignment: {
      personnelPosition: string | null;
      employeeLevel: string | null;
      personnelCategory: string | null;
      employmentRelationship: string | null;
      personnelSource: string | null;
      workArrangement: string;
    },
    dto: UpdateEmployeeDto,
  ) {
    const snapshots = new Map<string, {
      oldValue: Prisma.InputJsonValue | null;
      newValue: Prisma.InputJsonValue | null;
    }>();

    for (const field of [
      'personnelPosition',
      'employeeLevel',
      'personnelCategory',
      'employmentRelationship',
      'personnelSource',
      'workArrangement',
    ] as const) {
      if (dto[field] === undefined) continue;
      const oldCode = currentAssignment[field];
      const newCode = dto[field];
      snapshots.set(field, {
        oldValue: enumValue(oldCode, employeeEnumLabel(field, oldCode)),
        newValue: enumValue(newCode, employeeEnumLabel(field, newCode)),
      });
    }
    return snapshots;
  }


  private toDate(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
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

  private getAgreementType(employmentRelationship: string) {
    if (employmentRelationship === 'INTERN') return AgreementType.INTERNSHIP_AGREEMENT;
    if (employmentRelationship === 'LABOR_WORKER') return AgreementType.LABOR_SERVICE_CONTRACT;
    return AgreementType.LABOR_CONTRACT;
  }

  private handleUniqueConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = error.meta?.target;
      const targets = (Array.isArray(target) ? target : [target])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase());
      if (targets.some((value) => value.includes('employee_no'))) {
        throw new ConflictException('工号已存在');
      }
      if (targets.some((value) => value.includes('id_card_no'))) {
        throw new ConflictException('证件号码已存在');
      }
      if (
        targets.some((value) => value.includes('document_type'))
        && targets.some((value) => value.includes('document_number'))
      ) {
        throw new ConflictException('该类型的证件号码已存在');
      }
      throw new ConflictException('员工唯一信息已存在');
    }
    throw error;
  }
}
