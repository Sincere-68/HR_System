import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentStatus,
  AssignmentType,
  EmploymentApplicationStatus,
  EmploymentConversionType,
  EmploymentRelationship,
  EmploymentStatus,
  Prisma,
  ProcessStatus,
  RecordStatus,
  WorkArrangement,
} from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AccessControlService } from '../access-control/access-control.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmploymentApprovalRuntimeService } from '../employment-approvals/employment-approval-runtime.service';
import type { CreateEmploymentConversionDto, QueryEmploymentConversionsDto } from './dto';

const OPEN_CONVERSION_STATUSES: EmploymentApplicationStatus[] = [
  EmploymentApplicationStatus.DRAFT,
  EmploymentApplicationStatus.PENDING,
  EmploymentApplicationStatus.APPROVED,
  EmploymentApplicationStatus.PENDING_EFFECTIVE,
];
const ACTIVATABLE_APPROVAL_STATUS = EmploymentApplicationStatus.PENDING_EFFECTIVE;

type SourcePeriodWithAssignments = Prisma.EmploymentPeriodGetPayload<{
  include: { employee: true; assignments: true };
}>;

type ConversionWithSource = Prisma.EmploymentConversionGetPayload<{
  include: {
    sourceEmploymentPeriod: {
      include: {
        employee: true;
        assignments: true;
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
export class EmploymentConversionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly approvalRuntime: EmploymentApprovalRuntimeService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateEmploymentConversionDto) {
    const plannedEffectiveDate = this.parseBusinessDate(dto.plannedEffectiveDate);
    this.assertTodayOrFuture(plannedEffectiveDate);

    const source = await this.prisma.employmentPeriod.findFirst({
      where: {
        id: dto.sourceEmploymentPeriodId,
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } },
      },
      include: {
        employee: true,
        assignments: {
          where: { status: AssignmentStatus.ACTIVE, archivedAt: null },
          orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
        },
      },
    }) as SourcePeriodWithAssignments | null;
    if (!source) throw new NotFoundException('源任职周期不存在');
    if (source.employeeId !== dto.employeeId) {
      throw new BadRequestException('源任职周期与员工不匹配');
    }
    if (!this.isConvertibleRelationship(source.employmentRelationship)) {
      throw new BadRequestException('仅实习或劳务任职可以发起转正式申请');
    }
    this.assertConversionType(source.employmentRelationship, dto.type);

    const sourceAssignment = source.assignments.find((assignment) => assignment.isPrimary)
      ?? source.assignments[0];
    if (!sourceAssignment) throw new ConflictException('源任职周期缺少当前主要任职');

    await this.assertOrganizationAccess(user, sourceAssignment.organizationId);
    await this.assertOrganizationAccess(user, dto.targetOrganizationId);
    const [targetOrganization, targetPosition, targetJobTitle] = await Promise.all([
      this.findTargetOrganization(dto.targetOrganizationId),
      dto.targetPositionId ? this.findTargetPosition(dto.targetPositionId) : Promise.resolve(null),
      dto.targetJobTitleId ? this.findTargetJobTitle(dto.targetJobTitleId) : Promise.resolve(null),
    ]);

    const duplicate = await this.prisma.employmentConversion.findFirst({
      where: {
        sourceEmploymentPeriodId: dto.sourceEmploymentPeriodId,
        archivedAt: null,
        status: { in: OPEN_CONVERSION_STATUSES },
      },
    });
    if (duplicate) throw new ConflictException('该源任职周期已有开放的转正式申请');

    try {
      return await this.prisma.$transaction(async (tx) => {
        let conversion: Record<string, unknown>;
        try {
          conversion = await tx.employmentConversion.create({
            data: {
              type: dto.type,
              employeeId: dto.employeeId,
              sourceEmploymentPeriodId: dto.sourceEmploymentPeriodId,
              targetOrganizationId: dto.targetOrganizationId,
              targetPositionId: dto.targetPositionId,
              targetJobTitleId: dto.targetJobTitleId,
              targetJobLevel: dto.targetJobLevel,
              plannedEffectiveDate,
              status: EmploymentApplicationStatus.DRAFT,
              sourceSnapshot: this.sourceSnapshot(source, sourceAssignment),
              targetSnapshot: this.targetSnapshot(
                dto,
                plannedEffectiveDate,
                targetOrganization,
                targetPosition,
                targetJobTitle,
              ),
            },
          }) as unknown as Record<string, unknown>;
        } catch (error) {
          if (this.isUniqueConflict(error)) {
            throw new ConflictException('该源任职周期已有开放的转正式申请');
          }
          throw error;
        }

        const approval = await (this.approvalRuntime as TransactionalApprovalRuntime)
          .createRequestInTransaction(tx, {
            businessType: dto.type,
            businessId: String(conversion.id),
            applicantUserId: user.id,
            title: this.approvalTitle(source.employee, dto.type),
          });
        return tx.employmentConversion.update({
          where: { id: conversion.id as string },
          data: {
            approvalRequestId: approval.id,
            status: EmploymentApplicationStatus.PENDING,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('该源任职周期已有开放的转正式申请');
      }
      throw error;
    }
  }

  async findAll(user: AuthenticatedUser, query: QueryEmploymentConversionsDto) {
    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? undefined
      : ((await this.access.getAccessibleOrganizationIds(user)) ?? []);
    const where: Prisma.EmploymentConversionWhereInput = {
      archivedAt: null,
      ...(!hasAllEmployeeData ? {
        targetOrganizationId: { in: accessibleOrganizationIds },
        sourceEmploymentPeriod: {
          assignments: { some: { organizationId: { in: accessibleOrganizationIds } } },
        },
      } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.keyword
        ? {
            employee: {
              is: {
                OR: [
                  { employeeNo: { contains: query.keyword } },
                  { name: { contains: query.keyword } },
                ],
              },
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.employmentConversion.findMany({
        where,
        orderBy: [{ plannedEffectiveDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          employee: { select: { id: true, employeeNo: true, name: true } },
          sourceEmploymentPeriod: {
            select: { id: true, employmentRelationship: true, sequenceNo: true },
          },
          targetOrganization: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.employmentConversion.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const conversion = await this.prisma.employmentConversion.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, employeeNo: true, name: true } },
        sourceEmploymentPeriod: {
          include: {
            assignments: { orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }] },
          },
        },
        targetOrganization: { select: { id: true, code: true, name: true } },
        targetPosition: { select: { id: true, name: true } },
        targetJobTitle: { select: { id: true, code: true, name: true } },
      },
    });
    if (!conversion || conversion.archivedAt) throw new NotFoundException('任职转换申请不存在');
    await this.assertConversionScope(user, conversion);
    return conversion;
  }

  async activate(user: AuthenticatedUser, id: string) {
    const conversion = await this.prisma.employmentConversion.findUnique({
      where: { id },
      include: {
        sourceEmploymentPeriod: {
          include: {
            employee: true,
            assignments: {
              where: { status: AssignmentStatus.ACTIVE, archivedAt: null },
              orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
            },
          },
        },
      },
    }) as ConversionWithSource | null;
    if (!conversion || conversion.archivedAt) throw new NotFoundException('任职转换申请不存在');
    await this.assertConversionScope(user, conversion);
    if (conversion.status === EmploymentApplicationStatus.COMPLETED) {
      throw new ConflictException('任职转换申请已生效，不能重复生效');
    }
    if (conversion.status !== EmploymentApplicationStatus.PENDING_EFFECTIVE) {
      throw new ConflictException('任职转换申请不在待生效状态');
    }
    if (!conversion.approvalRequestId) {
      throw new ConflictException('任职转换申请缺少审批引用');
    }
    const approvalRequestId = conversion.approvalRequestId;

    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id: approvalRequestId },
    });
    if (
      !approval
      || approval.businessType !== conversion.type
      || approval.businessId !== conversion.id
      || approval.status !== ProcessStatus.APPROVED
      || approval.employmentStatus !== ACTIVATABLE_APPROVAL_STATUS
    ) {
      throw new ConflictException('审批尚未完成，不能生效任职转换');
    }

    const effectiveDate = this.parseStoredBusinessDate(conversion.plannedEffectiveDate);
    if (effectiveDate > this.shanghaiBusinessDate()) {
      throw new ConflictException('计划生效日期未到，暂不能生效任职转换');
    }
    const sourceEndDate = this.previousUtcCalendarDate(effectiveDate);
    const sourceAssignment = conversion.sourceEmploymentPeriod.assignments.find((assignment) => assignment.isPrimary)
      ?? conversion.sourceEmploymentPeriod.assignments[0];
    if (!sourceAssignment) throw new ConflictException('源任职周期缺少当前主要任职');
    if (
      (conversion.sourceEmploymentPeriod.entryDate && sourceEndDate < conversion.sourceEmploymentPeriod.entryDate)
      || (sourceAssignment.startDate && sourceEndDate < sourceAssignment.startDate)
    ) {
      throw new ConflictException('生效日期与源任职开始日期重叠');
    }

    await this.prisma.$transaction(async (tx) => {
      const sourceEnded = await tx.employmentPeriod.updateMany({
        where: {
          id: conversion.sourceEmploymentPeriodId,
          employeeId: conversion.employeeId,
          status: RecordStatus.ACTIVE,
          archivedAt: null,
          actualExitDate: null,
        },
        data: {
          actualExitDate: sourceEndDate,
          employmentStatus: EmploymentStatus.TRANSFERRED_OUT,
        },
      });
      if (sourceEnded.count !== 1) throw new ConflictException('源任职周期已被其他操作更新');

      const assignmentsEnded = await tx.employeeAssignment.updateMany({
        where: {
          employeeId: conversion.employeeId,
          employmentPeriodId: conversion.sourceEmploymentPeriodId,
          status: AssignmentStatus.ACTIVE,
          archivedAt: null,
        },
        data: { endDate: sourceEndDate, status: AssignmentStatus.ENDED },
      });
      if (assignmentsEnded.count < 1) throw new ConflictException('源任职已被其他操作更新');

      const recordsEnded = await tx.employmentRecord.updateMany({
        where: {
          employeeId: conversion.employeeId,
          employmentPeriodId: conversion.sourceEmploymentPeriodId,
          currentFlag: true,
        },
        data: { currentFlag: false, endedAt: sourceEndDate },
      });
      if (recordsEnded.count < 1) throw new ConflictException('源人员状态已被其他操作更新');

      const latestPeriod = await tx.employmentPeriod.findFirst({
        where: { employeeId: conversion.employeeId },
        orderBy: [{ sequenceNo: 'desc' }, { id: 'desc' }],
        select: { sequenceNo: true },
      });
      const newPeriod = await tx.employmentPeriod.create({
        data: {
          employeeId: conversion.employeeId,
          sequenceNo: (latestPeriod?.sequenceNo ?? conversion.sourceEmploymentPeriod.sequenceNo) + 1,
          personnelCategory: conversion.sourceEmploymentPeriod.personnelCategory,
          personnelSource: conversion.sourceEmploymentPeriod.personnelSource,
          employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
          entryDate: effectiveDate,
          employmentStatus: EmploymentStatus.REGULAR,
          isRehire: false,
          previousPeriodId: conversion.sourceEmploymentPeriodId,
          status: RecordStatus.ACTIVE,
        },
      });
      const newAssignment = await tx.employeeAssignment.create({
        data: {
          employeeId: conversion.employeeId,
          employmentPeriodId: newPeriod.id,
          organizationId: conversion.targetOrganizationId,
          positionId: conversion.targetPositionId,
          jobLevel: conversion.targetJobLevel,
          jobTitleId: conversion.targetJobTitleId,
          workplaceName: sourceAssignment.workplaceName,
          personnelPosition: sourceAssignment.personnelPosition,
          employeeLevel: sourceAssignment.employeeLevel,
          personnelCategory: sourceAssignment.personnelCategory,
          personnelSource: sourceAssignment.personnelSource,
          employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
          assignmentType: AssignmentType.PRIMARY,
          workArrangement: WorkArrangement.CONTRACT_EMPLOYMENT,
          confirmationDate: null,
          trialPostEndDate: null,
          isPrimary: true,
          startDate: effectiveDate,
          status: AssignmentStatus.ACTIVE,
        },
      });
      await tx.employmentRecord.create({
        data: {
          employeeId: conversion.employeeId,
          employmentPeriodId: newPeriod.id,
          status: EmploymentStatus.REGULAR,
          effectiveAt: effectiveDate,
          currentFlag: true,
        },
      });
      await tx.employee.update({
        where: { id: conversion.employeeId },
        data: { organizationId: conversion.targetOrganizationId },
      });
      const conversionCompleted = await tx.employmentConversion.updateMany({
        where: {
          id: conversion.id,
          status: EmploymentApplicationStatus.PENDING_EFFECTIVE,
          archivedAt: null,
        },
        data: { status: EmploymentApplicationStatus.COMPLETED },
      });
      if (conversionCompleted.count !== 1) throw new ConflictException('任职转换申请已被其他操作更新');
      await (this.approvalRuntime as TransactionalApprovalRuntime)
        .completeEffectiveInTransaction(tx, approvalRequestId);
      return newAssignment;
    });

    return this.findOne(user, id);
  }

  private async assertConversionScope(user: AuthenticatedUser, conversion: {
    employeeId: string;
    targetOrganizationId: string;
    sourceEmploymentPeriod?: { assignments?: Array<{ organizationId: string }> };
  }) {
    if (this.access.hasAllEmployeeData(user)) return;
    const sourceOrganizationId = conversion.sourceEmploymentPeriod?.assignments?.[0]?.organizationId;
    if (!sourceOrganizationId) throw new ForbiddenException('无法确认源任职组织数据范围');
    const [sourceAllowed, targetAllowed] = await Promise.all([
      this.access.canAccessOrganizationInScope(user, sourceOrganizationId),
      this.access.canAccessOrganizationInScope(user, conversion.targetOrganizationId),
    ]);
    if (!sourceAllowed || !targetAllowed) {
      throw new ForbiddenException('源任职或目标组织不在当前账号的数据范围内');
    }
  }

  private async assertOrganizationAccess(user: AuthenticatedUser, organizationId: string) {
    if (!this.access.hasAllEmployeeData(user)) {
      const allowed = await this.access.canAccessOrganizationInScope(user, organizationId);
      if (!allowed) throw new ForbiddenException('所选部门不在当前账号的数据范围内');
    }
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, status: RecordStatus.ACTIVE, archivedAt: null },
    });
    if (!organization) throw new NotFoundException('目标组织不存在或已归档');
  }

  private async findTargetOrganization(id: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { id, status: RecordStatus.ACTIVE, archivedAt: null },
    });
    if (!organization) throw new NotFoundException('目标组织不存在或已归档');
    return organization;
  }

  private async findTargetPosition(id: string) {
    const position = await this.prisma.position.findFirst({
      where: { id, status: RecordStatus.ACTIVE, archivedAt: null },
    });
    if (!position) throw new NotFoundException('目标职位不存在或已归档');
    return position;
  }

  private async findTargetJobTitle(id: string) {
    const jobTitle = await this.prisma.jobTitle.findFirst({
      where: { id, status: RecordStatus.ACTIVE, archivedAt: null },
    });
    if (!jobTitle) throw new NotFoundException('目标职务不存在或已归档');
    return jobTitle;
  }

  private sourceSnapshot(
    source: SourcePeriodWithAssignments,
    assignment: SourcePeriodWithAssignments['assignments'][number],
  ): Prisma.InputJsonValue {
    return {
      employeeId: source.employeeId,
      employeeNo: source.employee.employeeNo,
      employmentPeriodId: source.id,
      sequenceNo: source.sequenceNo,
      personnelCategory: source.personnelCategory,
      personnelSource: source.personnelSource,
      employmentRelationship: source.employmentRelationship,
      entryDate: this.formatSnapshotDate(source.entryDate),
      employmentStatus: source.employmentStatus,
      assignment: {
        id: assignment.id,
        organizationId: assignment.organizationId,
        positionId: assignment.positionId,
        jobTitleId: assignment.jobTitleId,
        jobLevel: assignment.jobLevel,
        workplaceName: assignment.workplaceName,
        personnelPosition: assignment.personnelPosition,
        employeeLevel: assignment.employeeLevel,
        personnelCategory: assignment.personnelCategory,
        personnelSource: assignment.personnelSource,
        workArrangement: assignment.workArrangement,
      },
    };
  }

  private targetSnapshot(
    dto: CreateEmploymentConversionDto,
    plannedEffectiveDate: Date,
    organization: { id: string; code: string; name: string },
    position: { id: string; name: string } | null,
    jobTitle: { id: string; code: string; name: string } | null,
  ): Prisma.InputJsonValue {
    return {
      employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
      employmentStatus: EmploymentStatus.REGULAR,
      plannedEffectiveDate: this.formatSnapshotDate(plannedEffectiveDate),
      organization: { id: organization.id, code: organization.code, name: organization.name },
      position: position ? { id: position.id, name: position.name } : null,
      jobTitle: jobTitle ? { id: jobTitle.id, code: jobTitle.code, name: jobTitle.name } : null,
      targetOrganizationId: dto.targetOrganizationId,
      targetPositionId: dto.targetPositionId ?? null,
      targetJobTitleId: dto.targetJobTitleId ?? null,
      targetJobLevel: dto.targetJobLevel ?? null,
    };
  }

  private approvalTitle(employee: { name?: string | null; employeeNo: string }, type: EmploymentConversionType) {
    const label = type === EmploymentConversionType.INTERN_TO_EMPLOYEE ? '实习转正式' : '劳务转正式';
    return `${employee.name ?? employee.employeeNo} ${label}`;
  }

  private isConvertibleRelationship(value: EmploymentRelationship) {
    return value === EmploymentRelationship.INTERN || value === EmploymentRelationship.LABOR_WORKER;
  }

  private assertConversionType(
    relationship: EmploymentRelationship,
    type: EmploymentConversionType,
  ) {
    const expected = relationship === EmploymentRelationship.INTERN
      ? EmploymentConversionType.INTERN_TO_EMPLOYEE
      : EmploymentConversionType.LABOR_TO_EMPLOYEE;
    if (type !== expected) throw new BadRequestException('转换类型与源任职关系不匹配');
  }

  private parseBusinessDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('生效日期格式必须为 YYYY-MM-DD');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('生效日期无效');
    }
    return date;
  }

  private parseStoredBusinessDate(value: Date) {
    return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }

  private previousUtcCalendarDate(value: Date) {
    const previous = new Date(value.getTime());
    previous.setUTCDate(previous.getUTCDate() - 1);
    return previous;
  }

  private formatSnapshotDate(value: Date | null) {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private assertTodayOrFuture(value: Date) {
    const shanghaiToday = this.shanghaiBusinessDate();
    if (value < shanghaiToday) {
      throw new BadRequestException('计划生效日期只能是今天或未来日期');
    }
  }

  private shanghaiBusinessDate(value = new Date()) {
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

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
