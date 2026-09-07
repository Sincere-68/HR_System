import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  AgreementStatus,
  AgreementType,
  AssignmentStatus,
  AssignmentType,
  AuditAction,
  EmploymentRelationship,
  EmploymentStatus,
  JobLevelCode,
  Prisma,
  ProcessStatus,
  RecordStatus,
  ReportingRelationshipType,
  WorkArrangement,
} from '@prisma/client';
import {
  isChinaAdministrativeRegionCode,
  PERSONNEL_FIELDS,
  type EmployeeFormOptions,
  type EmployeeImportResult,
  type EmployeeListItem,
  type EmployeeTransferRowResult,
  type Paginated,
  type PersonnelTransferFieldKey,
} from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService, type DemoEmployeeRecord } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { QueryRegularEmployeesDto } from './dto/query-regular-employees.dto';
import { EmployeeExportDto } from './dto/employee-transfer.dto';
import { InitialEmploymentDto, UpdateEmployeeDto } from './dto/update-employee.dto';
import { collectFieldChanges, directoryValue, enumValue } from './employee-field-change-log';
import { EMPLOYEE_ENUM_LABELS, employeeEnumLabel } from './employee-field-labels';
import { KNOWN_ACTIVE_EMPLOYEE_EXPORT_PROFILE } from './employee-import-column-profiles';
import {
  displayEmployeeName,
  presentDemoEmployeeDetail,
  presentDemoEmployeeListItem,
  presentEmployee,
  presentEmployeeDetail,
  presentEmployeeListItem,
  sortEmployeeListByEntryDateDesc,
} from './employees.presenter';
import {
  presentRegularEmployee,
  type RegularEmployeeListItem,
  type RegularEmployeeSnapshot,
} from './regular-employees.presenter';

function getEmployeeDetailInclude(now = new Date()) {
  return Prisma.validator<Prisma.EmployeeInclude>()({
    organization: { select: { id: true, code: true, name: true } },
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
          startDate: { not: null, lte: now },
          AND: [
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
            { OR: [{ terminationDate: null }, { terminationDate: { gt: now } }] },
          ],
        },
        orderBy: [{ startDate: 'desc' }, { renewalSequence: 'desc' }, { id: 'asc' }],
        take: 1,
        select: { id: true, employingCompanyId: true, employingCompany: { select: { id: true, code: true, name: true } } },
      },
    },
  },
  reportingAsEmployee: {
    where: {
      status: RecordStatus.ACTIVE,
      archivedAt: null,
      startDate: { not: null, lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
    include: { manager: { select: { id: true, name: true, workEmail: true } } },
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
      employmentPeriod: { entryDate: { not: null, lte: now } },
    },
    orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
    include: {
      organization: { select: { id: true, code: true, name: true } },
      position: { select: { id: true, name: true } },
      movementType: { select: { id: true, name: true } },
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
            startDate: { not: null, lte: now },
            AND: [
              { OR: [{ endDate: null }, { endDate: { gte: now } }] },
              { OR: [{ terminationDate: null }, { terminationDate: { gt: now } }] },
            ],
          },
          orderBy: [{ startDate: 'desc' }, { renewalSequence: 'desc' }, { id: 'asc' }],
          take: 1,
          select: { id: true, employingCompanyId: true, employingCompany: { select: { id: true, code: true, name: true } } },
        },
      },
    },
    assignments: {
      where: {
        status: AssignmentStatus.ACTIVE,
        archivedAt: null,
        startDate: { not: null, lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
      include: {
        organization: { select: { id: true, code: true, name: true } },
        position: { select: { id: true, name: true } },
        movementType: { select: { id: true, name: true } },
      },
    },
    reportingAsEmployee: {
      where: {
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        startDate: { not: null, lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
      include: { manager: { select: { id: true, name: true, workEmail: true } } },
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
        managers: [],
        employingCompanies: [],
        movementTypes: [],
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
      managers,
      employingCompanies,
      movementTypes,
    ] = await this.prisma.$transaction([
      this.prisma.position.findMany({
        where: {
          status: RecordStatus.ACTIVE,
          archivedAt: null,
        },
        select: { id: true, name: true, organizationId: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.employee.findMany({
        where: {
          ...managerWhere,
          name: { not: null },
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
      this.prisma.movementType.findMany({
        where: { status: RecordStatus.ACTIVE, archivedAt: null },
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      positions,
      managers: managers.map(({ id, name, employeeNo }) => ({ id, name: displayEmployeeName(name), employeeNo })),
      employingCompanies,
      movementTypes,
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
    const keyword = query.keyword || query.name;
    if (keyword) {
      conditions.push({
        OR: [
          { name: { contains: keyword } },
          { employeeNo: { contains: keyword } },
        ],
      });
    }
    if (query.employmentRelationship) {
      conditions.push({
        OR: [
          { assignments: { some: { ...currentAssignmentWhere, employmentRelationship: query.employmentRelationship } } },
          { assignments: { none: {} }, employmentPeriods: { some: { employmentRelationship: query.employmentRelationship } } },
        ],
      });
    }
    if (query.status) {
      conditions.push({
        employmentRecords: { some: { status: query.status, currentFlag: true } },
      });
    } else {
      conditions.push({
        OR: [
          { employmentRecords: { some: { currentFlag: true } } },
          { employmentRecords: { none: {} } },
        ],
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
      }),
      this.prisma.employee.count({ where }),
    ]);
    const sortedRows = sortEmployeeListByEntryDateDesc(
      rows.map((employee) => presentEmployeeListItem(employee, now, visibleOrganizationIds)),
    );
    const start = (page - 1) * pageSize;

    return {
      data: sortedRows.slice(start, start + pageSize),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Read-only database view for current regular employees. A row is rooted at an
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

  // Imports may create a partial employee master. A later row for the same
  // employee can atomically establish its first employment period and primary
  // assignment when it supplies the confirmed complete employment fields.
  async importEmployees(
    user: AuthenticatedUser,
    file: { originalname: string; buffer: Buffer } | undefined,
    auditContext: AuditContext,
  ): Promise<EmployeeImportResult> {
    if (!file) throw new BadRequestException('请选择要导入的 XLSX 或 CSV 文件');
    if (this.demo.enabled) throw new ConflictException('人员导入仅支持数据库模式');

    const extension = file.originalname.split('.').pop()?.toLocaleLowerCase();
    if (extension !== 'xlsx' && extension !== 'csv') {
      throw new BadRequestException('仅支持 .xlsx 或 .csv 文件');
    }
    const workbook = new ExcelJS.Workbook();
    if (extension === 'xlsx') {
      await workbook.xlsx.load(file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } else {
      const csvText = this.decodeImportCsv(file.buffer);
      const rows = this.parseImportCsv(csvText);
      const worksheet = workbook.addWorksheet('人员');
      rows.forEach((row) => worksheet.addRow(row));
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('导入文件不包含工作表');
    if (worksheet.rowCount > 10_001) throw new BadRequestException('单次最多导入 10000 行');

    const columns = this.resolveImportColumns(worksheet.getRow(1).values as unknown[]);
    if (!columns.has('employeeNo')) throw new BadRequestException('导入文件必须包含“工号”列');
    const results: EmployeeTransferRowResult[] = [];
    const seenEmployeeNos = new Set<string>();

    for (let index = 2; index <= worksheet.rowCount; index += 1) {
      const values = worksheet.getRow(index).values as unknown[];
      const input = this.readImportRow(columns, values);
      if (Object.values(input).every((value) => value === undefined)) continue;
      const employeeNo = input.employeeNo?.trim() ?? null;
      if (!employeeNo) {
        results.push({ rowNumber: index, employeeNo: null, action: 'FAILED', errors: ['工号不能为空'] });
        continue;
      }
      if (seenEmployeeNos.has(employeeNo)) {
        results.push({ rowNumber: index, employeeNo, action: 'FAILED', errors: ['导入文件中的工号重复'] });
        continue;
      }
      seenEmployeeNos.add(employeeNo);

      try {
        const existing = await this.prisma.employee.findUnique({
          where: { employeeNo },
          select: { id: true },
        });
        if (existing) {
          await this.assertImportEmployeeAccess(user, existing.id);
          const warnings = await this.applyImportedEmployeeRow(
            user,
            existing.id,
            input,
            auditContext,
          );
          results.push({ rowNumber: index, employeeNo, action: 'UPDATED', errors: [], warnings });
        } else {
          const warnings = await this.createPartialImportedEmployee(user, input, auditContext);
          results.push({ rowNumber: index, employeeNo, action: 'CREATED', errors: [], warnings });
        }
      } catch (error) {
        results.push({
          rowNumber: index,
          employeeNo,
          action: 'FAILED',
          errors: [error instanceof Error ? error.message : '导入失败'],
        });
      }
    }

    return {
      created: results.filter(({ action }) => action === 'CREATED').length,
      updated: results.filter(({ action }) => action === 'UPDATED').length,
      skipped: results.filter(({ action }) => action === 'SKIPPED').length,
      failed: results.filter(({ action }) => action === 'FAILED').length,
      rows: results,
    };
  }

  async getImportTemplate(format: 'XLSX' | 'CSV') {
    const fields = PERSONNEL_FIELDS.filter(({ importable }) => importable);
    const extension = format === 'XLSX' ? 'xlsx' : 'csv';
    const filename = `人员导入模板.${extension}`;
    if (format === 'CSV') {
      const csv = fields.map(({ title }) => `"${title}"`).join(',');
      return {
        buffer: Buffer.from(`﻿${csv}\r\n`, 'utf8'),
        filename,
        contentType: 'text/csv; charset=utf-8',
      };
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('人员');
    worksheet.addRow(fields.map(({ title }) => title));
    worksheet.getRow(1).font = { bold: true };
    worksheet.columns.forEach((column, index) => {
      column.width = Math.min(36, Math.max(12, fields[index]?.title.length ?? 12));
    });
    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async exportEmployees(user: AuthenticatedUser, dto: EmployeeExportDto) {
    const fields = dto.fields as PersonnelTransferFieldKey[];
    const query = dto.query ?? {};
    const now = new Date();
    const visibleOrganizationIds = this.access.hasAllEmployeeData(user)
      ? undefined
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];

    let rows: EmployeeListItem[];
    if (this.demo.enabled) {
      rows = this.findAllInDemo(user, {
        ...query,
        page: 1,
        pageSize: 10_000,
      } as QueryEmployeesDto).data as EmployeeListItem[];
    } else {
      const conditions: Prisma.EmployeeWhereInput[] = [];
      if (visibleOrganizationIds) {
        conditions.push(await this.access.getEmployeeWhere(user, visibleOrganizationIds, now));
      }
      const keyword = query.keyword || query.name;
      if (keyword) {
        conditions.push({
          OR: [
            { name: { contains: keyword } },
            { employeeNo: { contains: keyword } },
          ],
        });
      }
      if (query.employmentRelationship) {
        conditions.push({
          OR: [
            {
              assignments: {
                some: {
                  status: AssignmentStatus.ACTIVE,
                  archivedAt: null,
                  startDate: { lte: now },
                  OR: [{ endDate: null }, { endDate: { gte: now } }],
                  employmentRelationship: query.employmentRelationship,
                },
              },
            },
            {
              assignments: { none: {} },
              employmentPeriods: { some: { employmentRelationship: query.employmentRelationship } },
            },
          ],
        });
      }
      if (query.status) {
        conditions.push({ employmentRecords: { some: { status: query.status, currentFlag: true } } });
      } else {
        conditions.push({
          OR: [
            { employmentRecords: { some: { currentFlag: true } } },
            { employmentRecords: { none: {} } },
          ],
        });
      }
      if (query.organizationId) {
        const subtreeIds = await this.access.getOrganizationSubtreeIds(
          query.organizationId,
          visibleOrganizationIds,
        );
        conditions.push({
          OR: [
            {
              assignments: {
                some: {
                  status: AssignmentStatus.ACTIVE,
                  archivedAt: null,
                  startDate: { lte: now },
                  OR: [{ endDate: null }, { endDate: { gte: now } }],
                  organizationId: { in: subtreeIds },
                },
              },
            },
            { assignments: { none: {} }, organizationId: { in: subtreeIds } },
          ],
        });
      }
      if (dto.employeeIds?.length) {
        conditions.push({ id: { in: dto.employeeIds } });
      }
      const employees = await this.prisma.employee.findMany({
        where: { AND: conditions },
        include: getEmployeeListInclude(now),
        orderBy: [{ employeeNo: 'asc' }, { id: 'asc' }],
        take: 10_000,
      });
      rows = employees.map((employee) => presentEmployeeListItem(employee, now, visibleOrganizationIds));
    }

    if (dto.employeeIds?.length && this.demo.enabled) {
      const selectedIds = new Set(dto.employeeIds);
      rows = rows.filter(({ id }) => selectedIds.has(id));
    }

    const fieldDefinitions = fields.map((field) => {
      const definition = PERSONNEL_FIELDS.find(({ key }) => key === field);
      if (!definition) throw new BadRequestException(`不支持导出字段：${field}`);
      return definition;
    });
    const values = rows.map((row) => fieldDefinitions.map(({ key }) => this.exportCellValue(row[key as keyof EmployeeListItem])));
    const extension = dto.format === 'XLSX' ? 'xlsx' : 'csv';
    const filename = `人员导出_${this.utcCalendarDay().toISOString().slice(0, 10)}.${extension}`;

    if (dto.format === 'CSV') {
      const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
      const csv = [
        fieldDefinitions.map(({ title }) => escape(title)).join(','),
        ...values.map((row) => row.map((value) => escape(value)).join(',')),
      ].join('\r\n');
      return {
        buffer: Buffer.from(`﻿${csv}`, 'utf8'),
        filename,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('人员');
    worksheet.addRow(fieldDefinitions.map(({ title }) => title));
    values.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    worksheet.columns.forEach((column, index) => {
      column.width = Math.min(36, Math.max(12, fieldDefinitions[index]?.title.length ?? 12));
    });
    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async exportRegularEmployees(user: AuthenticatedUser, dto: EmployeeExportDto) {
    const result = await this.findRegularEmployees(user, {
      page: 1,
      pageSize: 10_000,
    } as QueryRegularEmployeesDto);
    const rows = dto.employeeIds?.length
      ? result.data.filter(({ employeeId }) => dto.employeeIds!.includes(employeeId))
      : result.data;
    return this.createTransferExportFile(rows, dto.fields, dto.format, '正式人员导出');
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
      throw new ConflictException('完整新增人员仅支持数据库模式');
    }

    await this.validateCreateRelations(user, dto);
    this.validateRegionCodes(dto);
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
            nativePlaceRegionCode: dto.nativePlaceRegionCode,
            householdType: dto.householdType,
            householdRegionCode: dto.householdRegionCode,
            householdAddress: dto.householdAddress,
            residentialRegionCode: dto.residentialRegionCode,
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
            workplaceName: dto.workplaceName,
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
              'workplaceName',
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
    const organizationChanged = dto.organizationId !== undefined && dto.organizationId !== current.organizationId;
    if (organizationChanged) {
      await this.access.assertOrganizationAccess(user, dto.organizationId!);
    }
    if (dto.initialEmployment) {
      await this.access.assertOrganizationAccess(user, dto.initialEmployment.organizationId);
    }
    const changedFields = Object.keys(dto);
    this.validateRegionCodes(dto);
    if (changedFields.length === 0) {
      if (this.demo.enabled) return presentDemoEmployeeDetail(current as DemoEmployeeRecord);
      const visibleOrganizationIds = this.access.hasAllEmployeeData(user)
        ? undefined
        : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
      return presentEmployeeDetail(current as Parameters<typeof presentEmployeeDetail>[0], new Date(), visibleOrganizationIds);
    }

    if (this.demo.enabled) {
      const employee = this.demo.updateEmployee(current as DemoEmployeeRecord, dto as never);
      await this.audit.create(auditContext, AuditAction.UPDATE, id, { changedFields });
      return presentDemoEmployeeDetail(employee);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const entryDateValidationDate = this.utcCalendarDay();
        const currentAssignment = await tx.employeeAssignment.findFirst({
          where: {
            employeeId: id,
            isPrimary: true,
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            employmentPeriod: { entryDate: { lte: entryDateValidationDate } },
          },
          orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            employmentPeriodId: true,
            positionId: true,
            position: { select: { id: true, name: true } },
            jobLevel: true,
            jobTitleId: true,
            workplaceName: true,
            assignmentType: true,
            personnelPosition: true,
            employeeLevel: true,
            personnelCategory: true,
            employmentRelationship: true,
            personnelSource: true,
            workArrangement: true,
            confirmationDate: true,
            trialPostEndDate: true,
            movementTypeId: true,
            changeReason: true,
            changeDescription: true,
            organization: { select: { id: true, code: true, name: true } },
            startDate: true,
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
          'name',
          'nationality',
          'workStartDate',
          'birthdayPreference',
          'lunarBirthDate',
          'workEmail',
          'personalEmail',
          'mobile',
          'gender',
          'birthDate',
          'ethnicity',
          'maritalStatus',
          'politicalStatus',
          'nativePlace',
          'nativePlaceRegionCode',
          'householdType',
          'householdRegionCode',
          'householdAddress',
          'residentialRegionCode',
          'residentialAddress',
          'bankName',
          'bankBranchName',
          'bankAccountNumber',
          'fullTimeDutyDescription',
          'partTimePositionName',
          'partTimeHourlyRate',
          'hasCompanyEquity',
          'totalWorkYears',
        ] as const;
        const profileChanges = collectFieldChanges(
          dto as Record<string, unknown>,
          current as unknown as Record<string, unknown>,
        ).filter(({ field }) => profileFields.includes(field as (typeof profileFields)[number]));
        if (dto.initialEmployment && currentAssignment) {
          throw new BadRequestException('当前员工已有主要任职记录，不能重复补建首段任职');
        }
        if (!currentAssignment && dto.initialEmployment) {
          await this.createInitialEmploymentForEmployee(
            tx,
            id,
            dto.initialEmployment,
            auditContext,
          );
        }
        if (organizationChanged && !currentAssignment && !dto.initialEmployment) {
          throw new BadRequestException('当前员工没有可更新的主要任职记录；请一次性补齐首段任职信息');
        }
        await tx.employee.update({
          where: { id },
          data: {
            name: dto.name, nationality: dto.nationality,
            workStartDate: dto.workStartDate ? this.toDate(dto.workStartDate) : undefined,
            birthdayPreference: dto.birthdayPreference,
            lunarBirthDate: dto.lunarBirthDate ? this.toDate(dto.lunarBirthDate) : undefined,
            workEmail: dto.workEmail, personalEmail: dto.personalEmail,
            mobile: dto.mobile, gender: dto.gender, birthDate: dto.birthDate ? this.toDate(dto.birthDate) : undefined,
            ethnicity: dto.ethnicity, maritalStatus: dto.maritalStatus, politicalStatus: dto.politicalStatus,
            nativePlace: dto.nativePlace, nativePlaceRegionCode: dto.nativePlaceRegionCode,
            householdType: dto.householdType, householdRegionCode: dto.householdRegionCode,
            householdAddress: dto.householdAddress, residentialRegionCode: dto.residentialRegionCode,
            residentialAddress: dto.residentialAddress, bankName: dto.bankName, bankBranchName: dto.bankBranchName,
            bankAccountNumber: dto.bankAccountNumber,
            fullTimeDutyDescription: dto.fullTimeDutyDescription,
            partTimePositionName: dto.partTimePositionName,
            partTimeHourlyRate: dto.partTimeHourlyRate ? new Prisma.Decimal(dto.partTimeHourlyRate) : undefined,
            hasCompanyEquity: dto.hasCompanyEquity,
            importedWorkYears: dto.totalWorkYears ? new Prisma.Decimal(dto.totalWorkYears) : undefined,
            importedWorkYearsAt: dto.totalWorkYears !== undefined ? new Date() : undefined,
            idCardNo: changesDocument ? legacyIdCardNo : undefined,
            organizationId: organizationChanged ? dto.organizationId : undefined,
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

        const assignmentFields = [
          'positionId',
          'jobLevel',
          'workplaceName',
          'personnelPosition',
          'employeeLevel',
          'personnelCategory',
          'employmentRelationship',
          'personnelSource',
          'workArrangement',
          'confirmationDate',
          'trialPostEndDate',
          'movementTypeId',
          'changeReason',
          'changeDescription',
        ] as const;
        const changesCurrentAssignment = assignmentFields.some((field) => dto[field] !== undefined);
        if (changesCurrentAssignment && !currentAssignment && !dto.initialEmployment) {
          throw new BadRequestException('当前员工没有可更新的主要任职记录；请一次性补齐首段任职信息');
        }
        if (currentAssignment && changesCurrentAssignment) {
          await this.validateCurrentAssignmentPosition(tx, dto);
        }
        if (dto.movementTypeId) {
          const movementTypeExists = await tx.movementType.count({
            where: { id: dto.movementTypeId, status: RecordStatus.ACTIVE, archivedAt: null },
          });
          if (!movementTypeExists) throw new BadRequestException('异动类型不存在或已停用');
        }
        if (dto.agreementEmployingCompanyId) {
          const companyExists = await tx.employingCompany.count({
            where: { id: dto.agreementEmployingCompanyId, status: RecordStatus.ACTIVE, archivedAt: null },
          });
          if (!companyExists) throw new BadRequestException('机构不存在或已停用');
        }
        if (dto.managerEmployeeId) {
          if (dto.managerEmployeeId === id) throw new BadRequestException('员工不能将自己设为直接经理');
          const managerExists = await tx.employee.count({ where: { id: dto.managerEmployeeId, archivedAt: null } });
          if (!managerExists) throw new BadRequestException('直接经理不存在');
        }
        if (currentAssignment && organizationChanged) {
          const effectiveDate = this.utcCalendarDay();
          const previousEndDate = new Date(effectiveDate);
          previousEndDate.setUTCDate(previousEndDate.getUTCDate() - 1);
          const assignmentChanges = await this.createAssignmentChangeSnapshots(tx, currentAssignment, dto);
          await tx.employeeAssignment.update({
            where: { id: currentAssignment.id },
            data: { endDate: previousEndDate, status: AssignmentStatus.ENDED },
          });
          const nextAssignment = await tx.employeeAssignment.create({
            data: {
              employeeId: id,
              employmentPeriodId: currentAssignment.employmentPeriodId,
              organizationId: dto.organizationId!,
              positionId: dto.positionId ?? currentAssignment.positionId,
              jobLevel: dto.jobLevel as import('@prisma/client').JobLevelCode | undefined ?? currentAssignment.jobLevel,
              jobTitleId: currentAssignment.jobTitleId,
              workplaceName: dto.workplaceName ?? currentAssignment.workplaceName,
              assignmentType: currentAssignment.assignmentType,
              personnelPosition: dto.personnelPosition ?? currentAssignment.personnelPosition,
              employeeLevel: dto.employeeLevel ?? currentAssignment.employeeLevel,
              personnelCategory: dto.personnelCategory ?? currentAssignment.personnelCategory,
              employmentRelationship: dto.employmentRelationship ?? currentAssignment.employmentRelationship,
              personnelSource: dto.personnelSource ?? currentAssignment.personnelSource,
              workArrangement: dto.workArrangement ?? currentAssignment.workArrangement,
              confirmationDate: dto.confirmationDate ? this.toDate(dto.confirmationDate) : currentAssignment.confirmationDate,
              trialPostEndDate: dto.trialPostEndDate ? this.toDate(dto.trialPostEndDate) : currentAssignment.trialPostEndDate,
              movementTypeId: dto.movementTypeId ?? currentAssignment.movementTypeId,
              changeReason: dto.changeReason ?? currentAssignment.changeReason,
              changeDescription: dto.changeDescription ?? currentAssignment.changeDescription,
              isPrimary: true,
              startDate: effectiveDate,
              status: AssignmentStatus.ACTIVE,
            },
            select: { id: true },
          });
          const targetOrganization = await tx.organization.findUniqueOrThrow({
            where: { id: dto.organizationId! },
            select: { id: true, name: true },
          });
          await tx.employeeFieldChangeLog.create({
            data: {
              employeeId: id,
              assignmentId: nextAssignment.id,
              changedField: 'organizationId',
              oldValue: directoryValue(currentAssignment.organization) ?? undefined,
              newValue: directoryValue(targetOrganization) ?? undefined,
              changedById: auditContext.userId,
            },
          });
          for (const field of assignmentFields) {
            if (dto[field] === undefined) continue;
            const snapshot = assignmentChanges.get(field);
            await tx.employeeFieldChangeLog.create({
              data: {
                employeeId: id,
                assignmentId: nextAssignment.id,
                changedField: field,
                oldValue: snapshot?.oldValue ?? undefined,
                newValue: snapshot?.newValue ?? undefined,
                changedById: auditContext.userId,
              },
            });
          }
        } else if (currentAssignment && changesCurrentAssignment) {
          const assignmentData = {
            positionId: dto.positionId ?? currentAssignment.positionId,
            jobLevel: dto.jobLevel as import('@prisma/client').JobLevelCode | undefined ?? currentAssignment.jobLevel,
            workplaceName: dto.workplaceName ?? currentAssignment.workplaceName,
            personnelPosition: dto.personnelPosition ?? currentAssignment.personnelPosition,
            employeeLevel: dto.employeeLevel ?? currentAssignment.employeeLevel,
            personnelCategory: dto.personnelCategory ?? currentAssignment.personnelCategory,
            employmentRelationship: dto.employmentRelationship ?? currentAssignment.employmentRelationship,
            personnelSource: dto.personnelSource ?? currentAssignment.personnelSource,
            workArrangement: dto.workArrangement ?? currentAssignment.workArrangement,
            confirmationDate: dto.confirmationDate ? this.toDate(dto.confirmationDate) : currentAssignment.confirmationDate,
            trialPostEndDate: dto.trialPostEndDate ? this.toDate(dto.trialPostEndDate) : currentAssignment.trialPostEndDate,
            movementTypeId: dto.movementTypeId ?? currentAssignment.movementTypeId,
            changeReason: dto.changeReason ?? currentAssignment.changeReason,
            changeDescription: dto.changeDescription ?? currentAssignment.changeDescription,
          };
          const changes = collectFieldChanges(dto as Record<string, unknown>, currentAssignment as unknown as Record<string, unknown>);
          const assignmentChanges = await this.createAssignmentChangeSnapshots(tx, currentAssignment, dto);
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
        if (currentAssignment && dto.assignmentStartDate !== undefined) {
          const assignmentStartDate = this.toDate(dto.assignmentStartDate);
          if (assignmentStartDate.getTime() !== currentAssignment.startDate?.getTime()) {
            await tx.employeeAssignment.update({
              where: { id: currentAssignment.id },
              data: { startDate: assignmentStartDate },
            });
            await tx.employeeFieldChangeLog.create({
              data: {
                employeeId: id,
                assignmentId: currentAssignment.id,
                changedField: 'assignmentStartDate',
                oldValue: currentAssignment.startDate?.toISOString().slice(0, 10) ?? undefined,
                newValue: dto.assignmentStartDate,
                changedById: auditContext.userId,
              },
            });
          }
        }
        if (currentAssignment?.employmentPeriodId && dto.entryDate !== undefined) {
          await tx.employmentPeriod.update({
            where: { id: currentAssignment.employmentPeriodId },
            data: { entryDate: this.toDate(dto.entryDate) },
          });
          await tx.employeeFieldChangeLog.create({
            data: {
              employeeId: id,
              assignmentId: currentAssignment.id,
              changedField: 'entryDate',
              newValue: dto.entryDate,
              changedById: auditContext.userId,
            },
          });
        }
        if (dto.agreementEmployingCompanyId !== undefined) {
          const agreement = await tx.employeeAgreement.findFirst({
            where: {
              employeeId: id,
              status: AgreementStatus.ACTIVE,
              archivedAt: null,
              startDate: { lte: entryDateValidationDate },
              OR: [{ endDate: null }, { endDate: { gte: entryDateValidationDate } }],
            },
            orderBy: [{ startDate: 'desc' }, { renewalSequence: 'desc' }, { id: 'asc' }],
            select: { id: true, employingCompanyId: true },
          });
          if (!agreement) {
            if (!currentAssignment?.employmentPeriodId) {
              throw new BadRequestException('当前员工没有可关联全日制公司的任职周期');
            }
            await tx.employeeAgreement.create({
              data: {
                employeeId: id,
                employmentPeriodId: currentAssignment.employmentPeriodId,
                agreementNo: `${id}-P${currentAssignment.employmentPeriodId}-IMPORT`,
                agreementType: this.getAgreementType(currentAssignment.employmentRelationship ?? 'INTERNAL_EMPLOYEE'),
                employingCompanyId: dto.agreementEmployingCompanyId,
                signingDate: currentAssignment.startDate,
                startDate: currentAssignment.startDate,
                status: AgreementStatus.ACTIVE,
              },
            });
            await tx.employeeFieldChangeLog.create({
              data: {
                employeeId: id,
                assignmentId: currentAssignment.id,
                changedField: 'agreementEmployingCompanyId',
                newValue: dto.agreementEmployingCompanyId,
                changedById: auditContext.userId,
              },
            });
          } else if (agreement.employingCompanyId !== dto.agreementEmployingCompanyId) {
            await tx.employeeAgreement.update({
              where: { id: agreement.id },
              data: { employingCompanyId: dto.agreementEmployingCompanyId },
            });
            await tx.employeeFieldChangeLog.create({
              data: {
                employeeId: id,
                assignmentId: currentAssignment?.id,
                changedField: 'agreementEmployingCompanyId',
                newValue: dto.agreementEmployingCompanyId,
                changedById: auditContext.userId,
              },
            });
          }
        }
        if (dto.managerEmployeeId !== undefined) {
          const relationship = await tx.reportingRelationship.findFirst({
            where: {
              employeeId: id,
              isPrimary: true,
              status: RecordStatus.ACTIVE,
              archivedAt: null,
              startDate: { lte: entryDateValidationDate },
              OR: [{ endDate: null }, { endDate: { gte: entryDateValidationDate } }],
            },
            orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
            select: { id: true, managerEmployeeId: true },
          });
          if (relationship) {
            await tx.reportingRelationship.update({
              where: { id: relationship.id },
              data: { managerEmployeeId: dto.managerEmployeeId },
            });
          } else {
            await tx.reportingRelationship.create({
              data: {
                employeeId: id,
                managerEmployeeId: dto.managerEmployeeId,
                relationshipType: ReportingRelationshipType.ADMINISTRATIVE,
                isPrimary: true,
                startDate: entryDateValidationDate,
                status: RecordStatus.ACTIVE,
              },
            });
          }
          await tx.employeeFieldChangeLog.create({
            data: {
              employeeId: id,
              assignmentId: currentAssignment?.id,
              changedField: 'managerEmployeeId',
              newValue: dto.managerEmployeeId,
              changedById: auditContext.userId,
            },
          });
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

  private decodeImportCsv(buffer: Buffer) {
    const utf8 = buffer.toString('utf8').replace(/^﻿/, '');
    if (this.hasRecognizedImportHeader(utf8)) return utf8;

    // Chinese Excel exports commonly use GB18030 but decode into mojibake
    // without replacement characters under UTF-8. Choose the encoding by
    // whether its first row contains a real Chinese business header instead
    // of relying on replacement-character detection alone.
    const gb18030 = new TextDecoder('gb18030').decode(buffer).replace(/^﻿/, '');
    return this.hasRecognizedImportHeader(gb18030) ? gb18030 : utf8;
  }

  private hasRecognizedImportHeader(value: string) {
    const headerRow = this.parseImportCsv(value)[0] ?? [];
    const knownHeaders = new Set(PERSONNEL_FIELDS.map(({ title }) => this.normalizeImportHeader(title)));
    return headerRow.some((header) => knownHeaders.has(this.normalizeImportHeader(header)));
  }

  private parseImportCsv(value: string) {
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

  private resolveImportColumns(values: unknown[]) {
    const columns = new Map<PersonnelTransferFieldKey, number>();
    values.forEach((value, index) => {
      const header = this.normalizeImportHeader(this.exportCellValue(value));
      // The import contract is the actual Chinese business column title shown
      // on the personnel table/template. Do not guess external system fields
      // such as JobNumber or OIdDepartment: their semantics are unconfirmed.
      const field = PERSONNEL_FIELDS.find(({ title, importable }) => (
        importable && this.normalizeImportHeader(title) === header
      ));
      if (field && !columns.has(field.key)) columns.set(field.key, index);
    });
    if (columns.has('employeeNo')) return columns;

    const externalHeaders = values.slice(1).map((value) => this.normalizeImportHeader(this.exportCellValue(value)));
    while (externalHeaders.at(-1) === '') externalHeaders.pop();
    const isKnownActiveEmployeeExport = externalHeaders.length === KNOWN_ACTIVE_EMPLOYEE_EXPORT_PROFILE.length
      && KNOWN_ACTIVE_EMPLOYEE_EXPORT_PROFILE.every(([header], index) => (
        this.normalizeImportHeader(header) === externalHeaders[index]
      ));
    if (!isKnownActiveEmployeeExport) return columns;

    KNOWN_ACTIVE_EMPLOYEE_EXPORT_PROFILE.forEach(([, field], index) => {
      if (field) columns.set(field, index + 1);
    });
    return columns;
  }

  private normalizeImportHeader(value: string) {
    return value
      .replace(/^﻿/, '')
      .replace(/ /g, ' ')
      .trim()
      .replace(/[\s\r\n]+/g, '')
      .replace(/[（）]/g, (character) => (character === '（' ? '(' : ')'))
      .toLocaleLowerCase();
  }

  private readImportRow(columns: Map<PersonnelTransferFieldKey, number>, values: unknown[]) {
    const input: Partial<Record<PersonnelTransferFieldKey, string>> = {};
    columns.forEach((columnIndex, field) => {
      const value = this.exportCellValue(values[columnIndex]).trim();
      if (value) input[field] = value;
    });
    return input;
  }

  private toImportUpdateInput(
    input: Partial<Record<PersonnelTransferFieldKey, string>>,
    warnings: string[] = [],
  ): UpdateEmployeeDto {
    const update: Record<string, string> = {};
    const passthroughFields: PersonnelTransferFieldKey[] = [
      'name', 'workEmail', 'personalEmail', 'mobile', 'documentNumber', 'nativePlace',
      'householdAddress', 'residentialAddress', 'jobLevel', 'workplaceName', 'bankBranchName', 'bankAccountNumber',
      'graduationSchoolName', 'major', 'totalWorkYears',
      'emergencyContactName', 'emergencyContactRelationship', 'emergencyContactMobile',
    ];
    passthroughFields.forEach((field) => {
      if (input[field] !== undefined) update[field] = input[field]!;
    });

    const enumFields = [
      'gender', 'personnelPosition', 'employeeLevel', 'personnelCategory', 'personnelSource',
      'employmentRelationship', 'workArrangement', 'documentType', 'ethnicity', 'maritalStatus',
      'politicalStatus', 'householdType', 'bankName', 'institutionType', 'highestEducation',
    ] as const;
    for (const field of enumFields) {
      const value = input[field];
      if (value === undefined) continue;
      const labels = EMPLOYEE_ENUM_LABELS[field];
      const code = Object.entries(labels ?? {}).find(([candidate, label]) => (
        candidate === value || label === value
      ))?.[0];
      if (code) {
        update[field] = code;
      } else {
        const title = PERSONNEL_FIELDS.find(({ key }) => key === field)?.title ?? field;
        warnings.push(`${title}“${value}”不在当前系统枚举中，未导入该字段`);
      }
    }
    if (input.totalWorkYears !== undefined) {
      try {
        update.totalWorkYears = this.normalizeImportWorkYears(input.totalWorkYears);
      } catch {
        warnings.push(`累计工龄（年）“${input.totalWorkYears}”格式不正确，未导入该字段`);
        delete update.totalWorkYears;
      }
    }
    const regionFields: Array<[PersonnelTransferFieldKey, string]> = [
      ['nativePlaceRegionCode', '籍贯地区'],
      ['householdRegionCode', '户籍所在地地区'],
      ['residentialRegionCode', '联系地址地区'],
    ];
    for (const [field, title] of regionFields) {
      const value = input[field];
      if (value === undefined) continue;
      if (isChinaAdministrativeRegionCode(value)) {
        update[field] = value;
      } else {
        warnings.push(`${title}行政区划代码“${value}”不存在，未导入该字段`);
      }
    }
    for (const field of ['birthDate', 'documentExpiryDate', 'graduationDate'] as const) {
      const value = input[field];
      if (value === undefined) continue;
      const normalized = this.normalizeOptionalImportDate(value, field, warnings);
      if (normalized !== undefined) update[field] = normalized;
    }
    return update as UpdateEmployeeDto;
  }

  private normalizeOptionalImportDate(value: string, field: string, warnings: string[]) {
    const normalized = value.trim();
    if (['-', '--', '—', '无', '暂无', '未填写', '不详', '长期', '长期有效', '无固定期限', '至今'].includes(normalized)) {
      return undefined;
    }
    try {
      return this.normalizeImportDate(normalized, field);
    } catch {
      warnings.push(`${field}“${value}”格式不正确，未导入该字段`);
      return undefined;
    }
  }

  private normalizeImportDate(value: string, field: string) {
    const normalized = value.trim().replace(/[/.]/g, '-');
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
      throw new BadRequestException(`${field} 必须为 YYYY-MM-DD、YYYY/MM/DD 或 YYYY.MM.DD`);
    }
    const [year, month, day] = normalized.split('-').map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day!));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) {
      throw new BadRequestException(`${field} 不是有效日期`);
    }
    return date.toISOString().slice(0, 10);
  }

  private async applyImportedEmployeeRow(
    user: AuthenticatedUser,
    employeeId: string,
    input: Partial<Record<PersonnelTransferFieldKey, string>>,
    auditContext: AuditContext,
  ) {
    const warnings: string[] = [];
    const profile = this.toImportUpdateInput(input, warnings);
    const importedOrganization = input.organizationName === undefined
      ? null
      : await this.resolveImportOrganization(user, input.organizationName, warnings);
    const employment = this.resolveImportEmployment(input, profile, importedOrganization, warnings);
    const importedEntryDateValue = input.entryDate === undefined
      ? undefined
      : this.normalizeOptionalImportDate(input.entryDate, '入职日期', warnings);
    const importedEntryDate = importedEntryDateValue === undefined
      ? undefined
      : this.toDate(importedEntryDateValue);
    const importedEmploymentStatus = input.employmentStatus === undefined
      ? undefined
      : this.normalizeImportEmploymentStatus(input.employmentStatus);
    if (input.employmentStatus !== undefined && !importedEmploymentStatus) {
      warnings.push(`人员状态“${input.employmentStatus}”不支持，未更新人员状态`);
    }
    const position = await this.resolveImportPosition(input.positionName, warnings);

    await this.prisma.$transaction(async (tx) => {
      await this.updateImportedEmployeeProfile(tx, employeeId, profile);

      let currentEmployment = await this.findCurrentImportEmployment(tx, employeeId);
      let createdEmployment = false;
      if (!currentEmployment && employment) {
        currentEmployment = await this.createImportedEmployment(
          tx,
          employeeId,
          employment,
          profile,
          position?.id,
        );
        createdEmployment = true;
      }

      if (currentEmployment && !createdEmployment) {
        await this.updateImportedEmployment(
          tx,
          employeeId,
          currentEmployment,
          profile,
          position?.id,
          importedOrganization?.id,
          importedEntryDate,
          importedEmploymentStatus,
        );
      } else if (!currentEmployment) {
        this.warnImportEmploymentValuesNotSaved(input, warnings);
      }

      await this.applyImportedDocument(tx, employeeId, input, profile, warnings);
      await this.applyImportedEmergencyContact(tx, employeeId, input, profile, warnings);
      await this.applyImportedEducation(tx, employeeId, input, profile, warnings);
      await this.applyImportedNamedRelations(
        tx,
        employeeId,
        currentEmployment?.period,
        input,
        warnings,
        currentEmployment
          ? (createdEmployment ? currentEmployment.period.entryDate ?? undefined : this.utcCalendarDay())
          : undefined,
      );
      await this.audit.create(auditContext, AuditAction.UPDATE, employeeId, {
        importRow: true,
        changedFields: Object.keys(input),
        createdEmployment,
      }, tx);
    });
    return warnings;
  }

  private resolveImportEmployment(
    input: Partial<Record<PersonnelTransferFieldKey, string>>,
    profile: UpdateEmployeeDto,
    organization: { id: string; code: string; name: string } | null,
    warnings: string[],
  ) {
    const assignmentSupplied = [
      'organizationName',
      'employmentRelationship',
      'workArrangement',
    ].some((field) => input[field as PersonnelTransferFieldKey] !== undefined);
    if (!assignmentSupplied || !organization || !profile.workArrangement) {
      if (assignmentSupplied && !organization) {
        warnings.push('部门未匹配，未创建部门任职');
      }
      return null;
    }

    const employmentStatus = input.employmentStatus === undefined
      ? EmploymentStatus.REGULAR
      : this.normalizeImportEmploymentStatus(input.employmentStatus);
    if (!employmentStatus) {
      warnings.push(`人员状态“${input.employmentStatus}”不支持，未创建任职周期和部门任职`);
      return null;
    }
    const normalizedEntryDate = input.entryDate === undefined
      ? undefined
      : this.normalizeOptionalImportDate(input.entryDate, '入职日期', warnings);
    return {
      organization,
      entryDate: normalizedEntryDate ? this.toDate(normalizedEntryDate) : null,
      employmentRelationship: profile.employmentRelationship ?? null,
      workArrangement: profile.workArrangement,
      employmentStatus,
    };
  }

  private async resolveImportOrganization(
    user: AuthenticatedUser,
    name: string,
    warnings: string[],
  ) {
    const accessibleOrganizationIds = await this.access.getAccessibleOrganizationIds(user);
    const organizations = await this.prisma.organization.findMany({
      where: {
        name: name.trim(),
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        ...(accessibleOrganizationIds === null ? {} : { id: { in: accessibleOrganizationIds } }),
      },
      select: { id: true, code: true, name: true },
      take: 2,
    });
    if (organizations.length === 1) return organizations[0]!;
    warnings.push(organizations.length === 0
      ? `部门“${name}”不存在、不在当前范围内或已停用，未创建任职周期和部门任职`
      : `部门“${name}”匹配多个有效部门，未创建任职周期和部门任职`);
    return null;
  }

  private async assertImportEmployeeAccess(user: AuthenticatedUser, employeeId: string) {
    if (this.access.hasAllEmployeeData(user)) return;
    const employeeWhere = await this.access.getEmployeeWhere(user);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, ...employeeWhere },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('员工不存在或不在当前数据范围内');
  }

  private async findCurrentImportEmployment(
    tx: Prisma.TransactionClient,
    employeeId: string,
  ) {
    const assignment = await tx.employeeAssignment.findFirst({
      where: {
        employeeId,
        isPrimary: true,
        status: AssignmentStatus.ACTIVE,
        archivedAt: null,
      },
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        employmentPeriodId: true,
        organizationId: true,
        positionId: true,
        jobLevel: true,
        jobTitleId: true,
        workplaceName: true,
        personnelPosition: true,
        employeeLevel: true,
        personnelCategory: true,
        personnelSource: true,
        employmentRelationship: true,
        workArrangement: true,
        confirmationDate: true,
        trialPostEndDate: true,
        movementTypeId: true,
        changeReason: true,
        changeDescription: true,
        startDate: true,
      },
    });
    if (!assignment?.employmentPeriodId) return null;
    const period = await tx.employmentPeriod.findUnique({
      where: { id: assignment.employmentPeriodId },
      select: { id: true, entryDate: true, employmentRelationship: true },
    });
    return period ? { assignment, period } : null;
  }

  private async createImportedEmployment(
    tx: Prisma.TransactionClient,
    employeeId: string,
    employment: {
      organization: { id: string; code: string; name: string };
      entryDate: Date | null;
      employmentRelationship: EmploymentRelationship | null;
      workArrangement: WorkArrangement;
      employmentStatus: EmploymentStatus;
    },
    profile: UpdateEmployeeDto,
    positionId: string | undefined,
  ) {
    const latestPeriod = await tx.employmentPeriod.findFirst({
      where: { employeeId },
      orderBy: [{ sequenceNo: 'desc' }, { id: 'desc' }],
      select: { sequenceNo: true },
    });
    const period = await tx.employmentPeriod.create({
      data: {
        employeeId,
        sequenceNo: (latestPeriod?.sequenceNo ?? 0) + 1,
        personnelCategory: profile.personnelCategory,
        personnelSource: profile.personnelSource,
        employmentRelationship: employment.employmentRelationship ?? EmploymentRelationship.INTERNAL_EMPLOYEE,
        entryDate: employment.entryDate,
        employmentStatus: employment.employmentStatus,
        isRehire: Boolean(latestPeriod),
        status: RecordStatus.ACTIVE,
      },
      select: { id: true, entryDate: true, employmentRelationship: true },
    });
    const assignment = await tx.employeeAssignment.create({
      data: {
        employeeId,
        employmentPeriodId: period.id,
        organizationId: employment.organization.id,
        positionId,
        jobLevel: profile.jobLevel as JobLevelCode | undefined,
        workplaceName: profile.workplaceName,
        personnelPosition: profile.personnelPosition,
        employeeLevel: profile.employeeLevel,
        personnelCategory: profile.personnelCategory,
        personnelSource: profile.personnelSource,
        employmentRelationship: employment.employmentRelationship,
        assignmentType: AssignmentType.PRIMARY,
        workArrangement: employment.workArrangement,
        isPrimary: true,
        startDate: employment.entryDate,
        status: AssignmentStatus.ACTIVE,
      },
      select: {
        id: true,
        employmentPeriodId: true,
        organizationId: true,
        positionId: true,
        jobLevel: true,
        jobTitleId: true,
        workplaceName: true,
        personnelPosition: true,
        employeeLevel: true,
        personnelCategory: true,
        personnelSource: true,
        employmentRelationship: true,
        workArrangement: true,
        confirmationDate: true,
        trialPostEndDate: true,
        movementTypeId: true,
        changeReason: true,
        changeDescription: true,
        startDate: true,
      },
    });
    await tx.employmentRecord.create({
      data: {
        employeeId,
        employmentPeriodId: period.id,
        status: employment.employmentStatus,
        effectiveAt: employment.entryDate ?? this.utcCalendarDay(),
        currentFlag: true,
      },
    });
    await tx.employee.update({ where: { id: employeeId }, data: { organizationId: employment.organization.id } });
    return { period, assignment };
  }

  private async updateImportedEmployeeProfile(
    tx: Prisma.TransactionClient,
    employeeId: string,
    profile: UpdateEmployeeDto,
  ) {
    await tx.employee.update({
      where: { id: employeeId },
      data: {
        name: profile.name,
        mobile: profile.mobile,
        workEmail: profile.workEmail,
        personalEmail: profile.personalEmail,
        gender: profile.gender,
        birthDate: profile.birthDate ? this.toDate(profile.birthDate) : undefined,
        ethnicity: profile.ethnicity,
        maritalStatus: profile.maritalStatus,
        politicalStatus: profile.politicalStatus,
        nativePlace: profile.nativePlace,
        nativePlaceRegionCode: profile.nativePlaceRegionCode,
        householdType: profile.householdType,
        householdRegionCode: profile.householdRegionCode,
        householdAddress: profile.householdAddress,
        residentialRegionCode: profile.residentialRegionCode,
        residentialAddress: profile.residentialAddress,
        bankName: profile.bankName,
        bankBranchName: profile.bankBranchName,
        bankAccountNumber: profile.bankAccountNumber,
        importedWorkYears: profile.totalWorkYears ? new Prisma.Decimal(profile.totalWorkYears) : undefined,
        importedWorkYearsAt: profile.totalWorkYears !== undefined ? new Date() : undefined,
      },
    });
  }

  private async updateImportedEmployment(
    tx: Prisma.TransactionClient,
    employeeId: string,
    currentEmployment: {
      assignment: {
        id: string;
        organizationId: string;
        positionId: string | null;
        jobLevel: JobLevelCode | null;
        jobTitleId: string | null;
        workplaceName: string | null;
        personnelPosition: import('@prisma/client').PersonnelPosition | null;
        employeeLevel: import('@prisma/client').EmployeeLevel | null;
        personnelCategory: import('@prisma/client').PersonnelCategory | null;
        personnelSource: import('@prisma/client').PersonnelSource | null;
        employmentRelationship: EmploymentRelationship | null;
        workArrangement: WorkArrangement;
        confirmationDate: Date | null;
        trialPostEndDate: Date | null;
        movementTypeId: string | null;
        changeReason: string | null;
        changeDescription: string | null;
      };
      period: { id: string; entryDate: Date | null; employmentRelationship: EmploymentRelationship };
    },
    profile: UpdateEmployeeDto,
    positionId: string | undefined,
    organizationId: string | undefined,
    entryDate: Date | undefined,
    employmentStatus: EmploymentStatus | undefined,
  ) {
    if (organizationId && organizationId !== currentEmployment.assignment.organizationId) {
      const effectiveDate = this.utcCalendarDay();
      const previousEndDate = new Date(effectiveDate);
      previousEndDate.setUTCDate(previousEndDate.getUTCDate() - 1);
      const assignmentData = this.getImportedAssignmentData(
        currentEmployment.assignment,
        profile,
        positionId,
        organizationId,
      );
      await tx.employeeAssignment.update({
        where: { id: currentEmployment.assignment.id },
        data: { endDate: previousEndDate, status: AssignmentStatus.ENDED },
      });
      await tx.employeeAssignment.create({
        data: {
          employeeId,
          employmentPeriodId: currentEmployment.period.id,
          ...assignmentData,
          jobTitleId: currentEmployment.assignment.jobTitleId,
          assignmentType: AssignmentType.PRIMARY,
          isPrimary: true,
          startDate: effectiveDate,
          status: AssignmentStatus.ACTIVE,
        },
      });
      await tx.employee.update({ where: { id: employeeId }, data: { organizationId } });
    } else {
      await this.updateImportedAssignment(
        tx,
        currentEmployment.assignment,
        profile,
        positionId,
        organizationId,
      );
    }
    if (entryDate !== undefined) {
      await tx.employmentPeriod.update({
        where: { id: currentEmployment.period.id },
        data: { entryDate },
      });
      await tx.employeeAssignment.update({
        where: { id: currentEmployment.assignment.id },
        data: { startDate: entryDate },
      });
    }
    if (employmentStatus !== undefined) {
      const currentRecord = await tx.employmentRecord.findFirst({
        where: { employeeId, currentFlag: true },
        orderBy: [{ effectiveAt: 'desc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (currentRecord) {
        await tx.employmentRecord.update({ where: { id: currentRecord.id }, data: { status: employmentStatus } });
      } else {
        await tx.employmentRecord.create({
          data: {
            employeeId,
            employmentPeriodId: currentEmployment.period.id,
            status: employmentStatus,
            effectiveAt: entryDate ?? currentEmployment.period.entryDate ?? this.utcCalendarDay(),
            currentFlag: true,
          },
        });
      }
    }
  }

  private getImportedAssignmentData(
    assignment: {
      organizationId: string;
      positionId: string | null;
      jobLevel: JobLevelCode | null;
      workplaceName: string | null;
      personnelPosition: import('@prisma/client').PersonnelPosition | null;
      employeeLevel: import('@prisma/client').EmployeeLevel | null;
      personnelCategory: import('@prisma/client').PersonnelCategory | null;
      personnelSource: import('@prisma/client').PersonnelSource | null;
      employmentRelationship: EmploymentRelationship | null;
      workArrangement: WorkArrangement;
      confirmationDate: Date | null;
      trialPostEndDate: Date | null;
      movementTypeId: string | null;
      changeReason: string | null;
      changeDescription: string | null;
    },
    profile: UpdateEmployeeDto,
    positionId: string | undefined,
    organizationId: string | undefined,
  ) {
    return {
      organizationId: organizationId ?? assignment.organizationId,
      positionId: positionId ?? assignment.positionId,
      jobLevel: profile.jobLevel as JobLevelCode | undefined ?? assignment.jobLevel,
      workplaceName: profile.workplaceName ?? assignment.workplaceName,
      personnelPosition: profile.personnelPosition ?? assignment.personnelPosition,
      employeeLevel: profile.employeeLevel ?? assignment.employeeLevel,
      personnelCategory: profile.personnelCategory ?? assignment.personnelCategory,
      personnelSource: profile.personnelSource ?? assignment.personnelSource,
      employmentRelationship: profile.employmentRelationship ?? assignment.employmentRelationship,
      workArrangement: profile.workArrangement ?? assignment.workArrangement,
      confirmationDate: profile.confirmationDate
        ? this.toDate(profile.confirmationDate)
        : assignment.confirmationDate,
      trialPostEndDate: profile.trialPostEndDate
        ? this.toDate(profile.trialPostEndDate)
        : assignment.trialPostEndDate,
      movementTypeId: profile.movementTypeId ?? assignment.movementTypeId,
      changeReason: profile.changeReason ?? assignment.changeReason,
      changeDescription: profile.changeDescription ?? assignment.changeDescription,
    };
  }

  private async updateImportedAssignment(
    tx: Prisma.TransactionClient,
    assignment: {
      id: string;
      organizationId: string;
      positionId: string | null;
      jobLevel: JobLevelCode | null;
      jobTitleId: string | null;
      workplaceName: string | null;
      personnelPosition: import('@prisma/client').PersonnelPosition | null;
      employeeLevel: import('@prisma/client').EmployeeLevel | null;
      personnelCategory: import('@prisma/client').PersonnelCategory | null;
      personnelSource: import('@prisma/client').PersonnelSource | null;
      employmentRelationship: EmploymentRelationship | null;
      workArrangement: WorkArrangement;
      confirmationDate: Date | null;
      trialPostEndDate: Date | null;
      movementTypeId: string | null;
      changeReason: string | null;
      changeDescription: string | null;
    },
    profile: UpdateEmployeeDto,
    positionId: string | undefined,
    organizationId: string | undefined,
  ) {
    const data = this.getImportedAssignmentData(assignment, profile, positionId, organizationId);
    await tx.employeeAssignment.update({ where: { id: assignment.id }, data });
  }

  private warnImportEmploymentValuesNotSaved(
    input: Partial<Record<PersonnelTransferFieldKey, string>>,
    warnings: string[],
  ) {
    const fields: Array<[PersonnelTransferFieldKey, string]> = [
      ['positionName', '职位'],
      ['jobLevel', '职级'],
      ['workplaceName', '工作地点'],
      ['personnelPosition', '人员定位'],
      ['employeeLevel', '员工层级'],
      ['personnelCategory', '人员类别'],
      ['personnelSource', '人员来源'],
      ['employmentRelationship', '雇佣关系'],
      ['employmentStatus', '人员状态'],
      ['workArrangement', '用工形式'],
    ];
    const supplied = fields.filter(([field]) => input[field] !== undefined).map(([, label]) => label);
    if (supplied.length > 0) {
      warnings.push(`未建立有效任职记录，以下任职字段未写入：${supplied.join('、')}`);
    }
  }

  private async applyImportedDocument(
    tx: Prisma.TransactionClient,
    employeeId: string,
    input: Partial<Record<PersonnelTransferFieldKey, string>>,
    profile: UpdateEmployeeDto,
    warnings: string[],
  ) {
    const fields = ['documentType', 'documentNumber', 'documentExpiryDate'] as const;
    if (!fields.some((field) => input[field] !== undefined)) return;
    const current = await tx.employeeIdentityDocument.findFirst({
      where: { employeeId, isPrimary: true, status: RecordStatus.ACTIVE, archivedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: { id: true, documentType: true, documentNumber: true },
    });
    const documentType = profile.documentType ?? current?.documentType;
    const documentNumber = input.documentNumber?.toUpperCase() ?? current?.documentNumber ?? null;
    if (!documentType) {
      warnings.push('证件类型未识别，未导入证件');
      return;
    }
    if (documentNumber) {
      const duplicateDocument = await tx.employeeIdentityDocument.findFirst({
        where: {
          documentType,
          documentNumber,
          ...(current ? { id: { not: current.id } } : {}),
        },
        select: { id: true },
      });
      if (duplicateDocument) {
        warnings.push(`证件类型和号码“${documentNumber}”已被其他人员使用，未导入证件`);
        return;
      }
      if (documentType === 'NATIONAL_ID') {
        const duplicateLegacyId = await tx.employee.findFirst({
          where: { id: { not: employeeId }, idCardNo: documentNumber },
          select: { id: true },
        });
        if (duplicateLegacyId) {
          warnings.push(`身份证号码“${documentNumber}”已被其他人员使用，未导入证件`);
          return;
        }
      }
    }
    const data = {
      documentType,
      documentNumber,
      expiryDate: profile.documentExpiryDate === undefined
        ? undefined
        : this.toDate(profile.documentExpiryDate),
    };
    if (current) {
      await tx.employeeIdentityDocument.update({ where: { id: current.id }, data });
    } else {
      await tx.employeeIdentityDocument.create({
        data: { employeeId, ...data, isPrimary: true, status: RecordStatus.ACTIVE },
      });
    }
    await tx.employee.update({
      where: { id: employeeId },
      data: { idCardNo: documentType === 'NATIONAL_ID' ? documentNumber : null },
    });
  }

  private async applyImportedEmergencyContact(
    tx: Prisma.TransactionClient,
    employeeId: string,
    input: Partial<Record<PersonnelTransferFieldKey, string>>,
    profile: UpdateEmployeeDto,
    warnings: string[],
  ) {
    const fields = ['emergencyContactName', 'emergencyContactRelationship', 'emergencyContactMobile'] as const;
    if (!fields.some((field) => input[field] !== undefined)) return;
    const current = await tx.employeeFamilyMember.findFirst({
      where: { employeeId, isEmergencyContact: true, status: RecordStatus.ACTIVE, archivedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, relationship: true, mobile: true },
    });
    const name = profile.emergencyContactName ?? current?.name ?? null;
    const relationship = profile.emergencyContactRelationship ?? current?.relationship;
    const mobile = profile.emergencyContactMobile ?? current?.mobile;
    if (!relationship) {
      warnings.push('紧急联系人缺少与本人关系，未创建独立联系人记录');
      return;
    }
    const data = { name, relationship, mobile };
    if (current) {
      await tx.employeeFamilyMember.update({ where: { id: current.id }, data });
    } else {
      await tx.employeeFamilyMember.create({
        data: { employeeId, ...data, isEmergencyContact: true, status: RecordStatus.ACTIVE },
      });
    }
  }

  private async applyImportedEducation(
    tx: Prisma.TransactionClient,
    employeeId: string,
    input: Partial<Record<PersonnelTransferFieldKey, string>>,
    profile: UpdateEmployeeDto,
    warnings: string[],
  ) {
    const fields = [
      'graduationSchoolName',
      'institutionType',
      'highestEducation',
      'graduationDate',
      'major',
    ] as const;
    if (!fields.some((field) => input[field] !== undefined)) return;
    const current = await tx.employeeEducationExperience.findFirst({
      where: { employeeId, isHighestEducation: true, status: RecordStatus.ACTIVE, archivedAt: null },
      orderBy: [{ graduationDate: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        schoolName: true,
        institutionType: true,
        educationLevel: true,
        graduationDate: true,
        major: true,
      },
    });
    const schoolName = profile.graduationSchoolName ?? current?.schoolName ?? null;
    const educationLevel = profile.highestEducation ?? current?.educationLevel ?? null;
    const data = {
      schoolName,
      institutionType: profile.institutionType ?? current?.institutionType,
      educationLevel,
      graduationDate: profile.graduationDate
        ? this.toDate(profile.graduationDate)
        : current?.graduationDate,
      major: profile.major ?? current?.major,
    };
    if (current) {
      await tx.employeeEducationExperience.update({ where: { id: current.id }, data });
    } else {
      await tx.employeeEducationExperience.create({
        data: { employeeId, ...data, isHighestEducation: true, status: RecordStatus.ACTIVE },
      });
    }
  }

  private async applyImportedNamedRelations(
    tx: Prisma.TransactionClient,
    employeeId: string,
    period: { id: string; entryDate: Date | null; employmentRelationship: EmploymentRelationship } | undefined,
    input: Partial<Record<PersonnelTransferFieldKey, string>>,
    warnings: string[],
    relationshipStartDate: Date | undefined,
  ) {
    if (input.fullTimeCompany !== undefined) {
      const company = await this.resolveImportEmployingCompanyInTransaction(tx, input.fullTimeCompany, warnings);
      if (company && period) {
        const agreementNo = `${employeeId}-P${period.id}-IMPORT`;
        const existing = await tx.employeeAgreement.findUnique({ where: { agreementNo }, select: { id: true } });
        if (existing) {
          await tx.employeeAgreement.update({ where: { id: existing.id }, data: { employingCompanyId: company.id } });
        } else {
          await tx.employeeAgreement.create({
            data: {
              employeeId,
              employmentPeriodId: period.id,
              agreementNo,
              agreementType: this.getAgreementType(period.employmentRelationship),
              employingCompanyId: company.id,
              signingDate: period.entryDate,
              startDate: period.entryDate,
              status: AgreementStatus.ACTIVE,
            },
          });
        }
      } else if (company) {
        warnings.push('当前员工未建立有效任职周期，全日制公司未导入');
      }
    }

    if (input.managerName !== undefined) {
      const managerName = input.managerName.trim();
      const managers = await tx.employee.findMany({
        where: {
          id: { not: employeeId },
          name: managerName,
          recordStatus: RecordStatus.ACTIVE,
          archivedAt: null,
        },
        select: { id: true },
        take: 2,
      });
      if (managers.length !== 1) {
        warnings.push(managers.length === 0
          ? `直线经理“${managerName}”不存在，未导入`
          : `直线经理“${managerName}”匹配多个员工，未导入`);
      } else {
        const nextManagerId = managers[0]!.id;
        if (await this.wouldCreateImportReportingCycle(tx, employeeId, nextManagerId)) {
          warnings.push(`直线经理“${managerName}”会形成循环汇报关系，未导入`);
          return;
        }
        const startDate = relationshipStartDate ?? period?.entryDate ?? this.utcCalendarDay();
        const current = await tx.reportingRelationship.findFirst({
          where: {
            employeeId,
            relationshipType: ReportingRelationshipType.ADMINISTRATIVE,
            isPrimary: true,
            status: RecordStatus.ACTIVE,
            archivedAt: null,
            startDate: { lte: startDate },
            OR: [{ endDate: null }, { endDate: { gte: startDate } }],
          },
          orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
          select: { id: true, managerEmployeeId: true },
        });
        if (current?.managerEmployeeId === nextManagerId) return;
        if (current) {
          const endDate = new Date(startDate);
          endDate.setUTCDate(endDate.getUTCDate() - 1);
          await tx.reportingRelationship.update({
            where: { id: current.id },
            data: { endDate, status: RecordStatus.INACTIVE },
          });
        }
        await tx.reportingRelationship.create({
          data: {
            employeeId,
            managerEmployeeId: nextManagerId,
            relationshipType: ReportingRelationshipType.ADMINISTRATIVE,
            isPrimary: true,
            startDate,
            status: RecordStatus.ACTIVE,
          },
        });
      }
    }
  }

  private async wouldCreateImportReportingCycle(
    tx: Prisma.TransactionClient,
    employeeId: string,
    managerEmployeeId: string,
  ) {
    if (employeeId === managerEmployeeId) return true;
    const visited = new Set<string>([employeeId]);
    let currentEmployeeId = managerEmployeeId;
    while (!visited.has(currentEmployeeId)) {
      visited.add(currentEmployeeId);
      const relationship = await tx.reportingRelationship.findFirst({
        where: {
          employeeId: currentEmployeeId,
          relationshipType: ReportingRelationshipType.ADMINISTRATIVE,
          isPrimary: true,
          status: RecordStatus.ACTIVE,
          archivedAt: null,
          startDate: { lte: this.utcCalendarDay() },
          OR: [{ endDate: null }, { endDate: { gte: this.utcCalendarDay() } }],
        },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        select: { managerEmployeeId: true },
      });
      if (!relationship) return false;
      currentEmployeeId = relationship.managerEmployeeId;
    }
    return true;
  }

  private async resolveImportEmployingCompanyInTransaction(
    tx: Prisma.TransactionClient,
    value: string,
    warnings: string[],
  ) {
    const normalized = value.trim();
    const byCode = await tx.employingCompany.findFirst({
      where: { code: normalized, status: RecordStatus.ACTIVE, archivedAt: null },
      select: { id: true },
    });
    if (byCode) return byCode;
    const byName = await tx.employingCompany.findMany({
      where: { name: normalized, status: RecordStatus.ACTIVE, archivedAt: null },
      select: { id: true },
      take: 2,
    });
    if (byName.length === 1) return byName[0]!;
    warnings.push(byName.length === 0
      ? `全日制公司“${normalized}”不存在，未导入`
      : `全日制公司“${normalized}”匹配多个目录项，未导入`);
    return null;
  }

  private normalizeImportWorkYears(value: string) {
    const normalized = value.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
      throw new BadRequestException('累计工龄（年）必须为非负且最多两位小数的数字');
    }
    return normalized;
  }

  private normalizeImportEmploymentStatus(value: string) {
    const labels: Record<string, EmploymentStatus> = {
      试用: EmploymentStatus.PROBATION,
      正式: EmploymentStatus.REGULAR,
      待入职: EmploymentStatus.PENDING_ENTRY,
      调出: EmploymentStatus.TRANSFERRED_OUT,
      待调入: EmploymentStatus.PENDING_TRANSFER_IN,
      退休: EmploymentStatus.RETIRED,
      离职: EmploymentStatus.RESIGNED,
      非正式: EmploymentStatus.NON_REGULAR,
    };
    return labels[value] ?? (Object.values(EmploymentStatus).includes(value as EmploymentStatus)
      ? value as EmploymentStatus
      : null);
  }

  private async resolveImportPosition(value: string | undefined, warnings: string[]) {
    if (!value) return null;
    const normalized = value.trim();
    if (/^\d{5}(?:\s*(?:[-－—–:：])\s*.+)?$/.test(normalized)) {
      warnings.push(`职位“${normalized}”包含已废止的职位编号，请仅填写职位名称`);
      return null;
    }

    const position = await this.prisma.position.findFirst({
      where: { name: normalized, status: RecordStatus.ACTIVE, archivedAt: null },
      select: { id: true },
    });
    if (position) return position;

    const activeCount = await this.prisma.position.count({
      where: { status: RecordStatus.ACTIVE, archivedAt: null },
    });
    warnings.push(activeCount === 0
      ? '职位目录未初始化，请先执行安全职位名称目录同步脚本'
      : `职位“${normalized}”不存在，未导入`);
    return null;
  }

  private async createPartialImportedEmployee(
    user: AuthenticatedUser,
    input: Partial<Record<PersonnelTransferFieldKey, string>>,
    auditContext: AuditContext,
  ): Promise<string[]> {
    const employeeNo = input.employeeNo?.trim();
    if (!employeeNo) {
      throw new BadRequestException('工号不能为空');
    }

    const warnings: string[] = [];
    const profile = this.toImportUpdateInput(input, warnings);
    const importedOrganization = input.organizationName === undefined
      ? null
      : await this.resolveImportOrganization(user, input.organizationName, warnings);
    const employment = this.resolveImportEmployment(input, profile, importedOrganization, warnings);
    const position = await this.resolveImportPosition(input.positionName, warnings);
    await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          employeeNo,
          name: profile.name ?? null,
          mobile: profile.mobile ?? null,
          workEmail: profile.workEmail,
          personalEmail: profile.personalEmail,
          gender: profile.gender,
          birthDate: profile.birthDate ? this.toDate(profile.birthDate) : undefined,
          ethnicity: profile.ethnicity,
          maritalStatus: profile.maritalStatus,
          politicalStatus: profile.politicalStatus,
          nativePlace: profile.nativePlace,
          nativePlaceRegionCode: profile.nativePlaceRegionCode,
          householdType: profile.householdType,
          householdRegionCode: profile.householdRegionCode,
          householdAddress: profile.householdAddress,
          residentialRegionCode: profile.residentialRegionCode,
          residentialAddress: profile.residentialAddress,
          bankName: profile.bankName,
          bankBranchName: profile.bankBranchName,
          bankAccountNumber: profile.bankAccountNumber,
          importedWorkYears: profile.totalWorkYears ? new Prisma.Decimal(profile.totalWorkYears) : undefined,
          importedWorkYearsAt: profile.totalWorkYears !== undefined ? new Date() : undefined,
        },
        select: { id: true },
      });
      const currentEmployment = employment
        ? await this.createImportedEmployment(tx, employee.id, employment, profile, position?.id)
        : null;
      if (!currentEmployment) this.warnImportEmploymentValuesNotSaved(input, warnings);
      await this.applyImportedDocument(tx, employee.id, input, profile, warnings);
      await this.applyImportedEmergencyContact(tx, employee.id, input, profile, warnings);
      await this.applyImportedEducation(tx, employee.id, input, profile, warnings);
      await this.applyImportedNamedRelations(
        tx,
        employee.id,
        currentEmployment?.period,
        input,
        warnings,
        currentEmployment?.period.entryDate ?? undefined,
      );
      await this.audit.create(
        auditContext,
        AuditAction.CREATE,
        employee.id,
        { importRow: true, changedFields: Object.keys(input), createdEmployment: Boolean(currentEmployment) },
        tx,
      );
    });
    return warnings;
  }

  private async createTransferExportFile(
    rows: Array<object>,
    fields: string[],
    format: 'XLSX' | 'CSV',
    name: string,
  ) {
    const definitions = fields.map((key) => {
      const definition = PERSONNEL_FIELDS.find((field) => field.key === key);
      if (!definition) throw new BadRequestException(`不支持导出字段：${key}`);
      return definition;
    });
    const values = rows.map((row) => definitions.map(({ key }) => this.exportCellValue((row as Record<string, unknown>)[key])));
    const extension = format === 'XLSX' ? 'xlsx' : 'csv';
    const filename = `${name}_${this.utcCalendarDay().toISOString().slice(0, 10)}.${extension}`;
    if (format === 'CSV') {
      const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
      return {
        buffer: Buffer.from(`﻿${[definitions.map(({ title }) => quote(title)).join(','), ...values.map((row) => row.map(quote).join(','))].join('\r\n')}`, 'utf8'),
        filename,
        contentType: 'text/csv; charset=utf-8',
      };
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('导出数据');
    worksheet.addRow(definitions.map(({ title }) => title));
    values.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private exportCellValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
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
  ): Paginated<EmployeeListItem> {
    let employees = this.demo.getEmployees().filter(
      (employee) => this.access.canAccessOrganization(user, employee.organizationId),
    );
    if (query.organizationId) {
      employees = this.access.canAccessOrganization(user, query.organizationId)
        ? employees.filter((employee) => employee.organizationId === query.organizationId)
        : [];
    }
    const keyword = query.keyword || query.name;
    if (keyword) {
      const normalizedKeyword = keyword.toLocaleLowerCase();
      employees = employees.filter((employee) => (
        employee.name.toLocaleLowerCase().includes(normalizedKeyword)
        || employee.employeeNo.toLocaleLowerCase().includes(normalizedKeyword)
      ));
    }
    if (query.employmentRelationship) {
      // The in-memory Demo model does not retain normalized employment periods,
      // so its records have no reliable employment-relationship source.
      employees = [];
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

  private async validateCurrentAssignmentPosition(
    tx: Prisma.TransactionClient,
    dto: Pick<UpdateEmployeeDto, 'positionId'>,
  ) {
    if (dto.positionId) {
      const position = await tx.position.findFirst({
        where: { id: dto.positionId, status: RecordStatus.ACTIVE, archivedAt: null },
        select: { id: true },
      });
      if (!position) throw new BadRequestException('职位不存在、已停用或已归档');
    }
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
          archivedAt: null,
        },
      }));
      labels.push('职位不存在、已停用或已归档');
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

  private validateRegionCodes(dto: Pick<
    CreateEmployeeDto | UpdateEmployeeDto,
    'nativePlaceRegionCode' | 'householdRegionCode' | 'residentialRegionCode'
  >) {
    const fields = [
      ['nativePlaceRegionCode', '籍贯地区'],
      ['householdRegionCode', '户籍所在地地区'],
      ['residentialRegionCode', '联系地址地区'],
    ] as const;
    for (const [field, label] of fields) {
      const code = dto[field];
      if (code !== undefined && !isChinaAdministrativeRegionCode(code)) {
        throw new BadRequestException(`${label}行政区划代码不存在`);
      }
    }
  }

  private async createInitialEmploymentForEmployee(
    tx: Prisma.TransactionClient,
    employeeId: string,
    input: InitialEmploymentDto,
    auditContext: AuditContext,
  ) {
    const position = input.positionId
      ? await tx.position.findFirst({
        where: { id: input.positionId, status: RecordStatus.ACTIVE, archivedAt: null },
        select: { id: true },
      })
      : null;
    if (input.positionId && !position) {
      throw new BadRequestException('职位不存在、已停用或已归档');
    }
    const organization = await tx.organization.findFirst({
      where: { id: input.organizationId, status: RecordStatus.ACTIVE, archivedAt: null },
      select: { id: true, code: true, name: true },
    });
    if (!organization) {
      throw new BadRequestException('部门不存在、已停用或已归档');
    }

    const entryDate = this.toDate(input.entryDate);
    const period = await tx.employmentPeriod.create({
      data: {
        employeeId,
        sequenceNo: 1,
        personnelCategory: input.personnelCategory,
        personnelSource: input.personnelSource,
        employmentRelationship: input.employmentRelationship,
        entryDate,
        employmentStatus: input.employmentStatus,
        isRehire: false,
        status: RecordStatus.ACTIVE,
      },
    });
    const assignment = await tx.employeeAssignment.create({
      data: {
        employeeId,
        employmentPeriodId: period.id,
        organizationId: organization.id,
        positionId: position?.id,
        jobLevel: input.jobLevel as never,
        workplaceName: input.workplaceName,
        personnelPosition: input.personnelPosition,
        employeeLevel: input.employeeLevel,
        personnelCategory: input.personnelCategory,
        personnelSource: input.personnelSource,
        employmentRelationship: input.employmentRelationship,
        assignmentType: AssignmentType.PRIMARY,
        workArrangement: input.workArrangement,
        isPrimary: true,
        startDate: entryDate,
        status: AssignmentStatus.ACTIVE,
      },
      select: { id: true },
    });
    await tx.employmentRecord.create({
      data: {
        employeeId,
        employmentPeriodId: period.id,
        status: input.employmentStatus,
        effectiveAt: entryDate,
        currentFlag: true,
      },
    });
    await tx.employee.update({ where: { id: employeeId }, data: { organizationId: organization.id } });
    const values = [
      ['organizationId', directoryValue(organization)],
      ['personnelCategory', enumValue(input.personnelCategory, employeeEnumLabel('personnelCategory', input.personnelCategory))],
      ['personnelSource', enumValue(input.personnelSource, employeeEnumLabel('personnelSource', input.personnelSource))],
      ['employmentRelationship', enumValue(input.employmentRelationship, employeeEnumLabel('employmentRelationship', input.employmentRelationship))],
      ['workArrangement', enumValue(input.workArrangement, employeeEnumLabel('workArrangement', input.workArrangement))],
      ['employmentStatus', enumValue(input.employmentStatus, employeeEnumLabel('employmentStatus', input.employmentStatus))],
    ] as const;
    for (const [changedField, newValue] of values) {
      await tx.employeeFieldChangeLog.create({
        data: {
          employeeId,
          assignmentId: assignment.id,
          changedField,
          newValue: newValue ?? undefined,
          changedById: auditContext.userId,
        },
      });
    }
  }

  private async createAssignmentChangeSnapshots(
    tx: Prisma.TransactionClient,
    currentAssignment: {
      positionId: string | null;
      position: { id: string; name: string } | null;
      jobLevel: import('@prisma/client').JobLevelCode | null;
      workplaceName: string | null;
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
      'positionId',
      'jobLevel',
      'workplaceName',
      'personnelPosition',
      'employeeLevel',
      'personnelCategory',
      'employmentRelationship',
      'personnelSource',
      'workArrangement',
    ] as const) {
      if (dto[field] === undefined) continue;
      const oldValue = currentAssignment[field];
      const newValue = dto[field];
      const isEnum = EMPLOYEE_ENUM_LABELS[field] !== undefined;
      const oldSnapshot = field === 'positionId'
        ? directoryValue(currentAssignment.position)
        : isEnum
          ? enumValue(oldValue, employeeEnumLabel(field, oldValue))
          : oldValue;
      let newSnapshot: Prisma.InputJsonValue | null = newValue ?? null;
      if (field === 'positionId' && newValue) {
        const position = await tx.position.findUnique({
          where: { id: newValue },
          select: { id: true, name: true },
        });
        newSnapshot = directoryValue(position);
      } else if (isEnum) {
        newSnapshot = enumValue(newValue, employeeEnumLabel(field, newValue));
      }
      snapshots.set(field, { oldValue: oldSnapshot, newValue: newSnapshot });
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
