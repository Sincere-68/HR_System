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
      employmentPeriod: { entryDate: { lte: now } },
    },
    orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
    include: {
      organization: { select: { id: true, code: true, name: true } },
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
        organization: { select: { id: true, code: true, name: true } },
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
          archivedAt: null,
        },
        select: { id: true, code: true, name: true, organizationId: true },
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.workplace.findMany({
        where: { status: RecordStatus.ACTIVE },
        select: { id: true, name: true },
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
    ]);

    return {
      positions,
      workplaces,
      managers: managers.map(({ id, name, employeeNo }) => ({ id, name: displayEmployeeName(name), employeeNo })),
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
          select: {
            id: true,
            assignments: {
              where: { isPrimary: true, status: AssignmentStatus.ACTIVE, archivedAt: null },
              take: 1,
              select: { id: true },
            },
          },
        });
        if (existing) {
          const update = this.toImportUpdateInput(input);
          const hasCurrentPrimaryAssignment = existing.assignments.length > 0;
          if (!hasCurrentPrimaryAssignment && this.hasImportEmploymentValues(input)) {
            const warnings = await this.completeImportedEmployment(user, existing.id, input, update, auditContext);
            results.push({ rowNumber: index, employeeNo, action: 'UPDATED', errors: [], warnings });
            continue;
          }
          if (Object.keys(update).length === 0) {
            results.push({ rowNumber: index, employeeNo, action: 'SKIPPED', errors: [] });
            continue;
          }
          await this.update(user, existing.id, update, auditContext);
          results.push({ rowNumber: index, employeeNo, action: 'UPDATED', errors: [] });
        } else {
          await this.createPartialImportedEmployee(user, input, auditContext);
          results.push({ rowNumber: index, employeeNo, action: 'CREATED', errors: [] });
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
      if (query.keyword) {
        conditions.push({
          OR: [
            { name: { contains: query.keyword } },
            { employeeNo: { contains: query.keyword } },
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
            jobLevel: true,
            jobTitleId: true,
            workplaceId: true,
            assignmentType: true,
            personnelPosition: true,
            employeeLevel: true,
            personnelCategory: true,
            employmentRelationship: true,
            personnelSource: true,
            workArrangement: true,
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
          'nativePlaceRegionCode',
          'householdType',
          'householdRegionCode',
          'householdAddress',
          'residentialRegionCode',
          'residentialAddress',
          'bankName',
          'bankBranchName',
          'bankAccountNumber',
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
            employeeNo: dto.employeeNo, name: dto.name, workEmail: dto.workEmail, personalEmail: dto.personalEmail,
            mobile: dto.mobile, gender: dto.gender, birthDate: dto.birthDate ? this.toDate(dto.birthDate) : undefined,
            ethnicity: dto.ethnicity, maritalStatus: dto.maritalStatus, politicalStatus: dto.politicalStatus,
            nativePlace: dto.nativePlace, nativePlaceRegionCode: dto.nativePlaceRegionCode,
            householdType: dto.householdType, householdRegionCode: dto.householdRegionCode,
            householdAddress: dto.householdAddress, residentialRegionCode: dto.residentialRegionCode,
            residentialAddress: dto.residentialAddress, bankName: dto.bankName, bankBranchName: dto.bankBranchName,
            bankAccountNumber: dto.bankAccountNumber,
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

        const assignmentFields = ['personnelPosition', 'employeeLevel', 'personnelCategory', 'employmentRelationship', 'personnelSource', 'workArrangement'] as const;
        const changesCurrentAssignment = assignmentFields.some((field) => dto[field] !== undefined);
        if (changesCurrentAssignment && !currentAssignment && !dto.initialEmployment) {
          throw new BadRequestException('当前员工没有可更新的主要任职记录；请一次性补齐首段任职信息');
        }
        if (currentAssignment && organizationChanged) {
          const effectiveDate = this.utcCalendarDay();
          const previousEndDate = new Date(effectiveDate);
          previousEndDate.setUTCDate(previousEndDate.getUTCDate() - 1);
          const assignmentChanges = this.createAssignmentChangeSnapshots(currentAssignment, dto);
          await tx.employeeAssignment.update({
            where: { id: currentAssignment.id },
            data: { endDate: previousEndDate, status: AssignmentStatus.ENDED },
          });
          const nextAssignment = await tx.employeeAssignment.create({
            data: {
              employeeId: id,
              employmentPeriodId: currentAssignment.employmentPeriodId,
              organizationId: dto.organizationId!,
              positionId: currentAssignment.positionId,
              jobLevel: currentAssignment.jobLevel,
              jobTitleId: currentAssignment.jobTitleId,
              workplaceId: currentAssignment.workplaceId,
              assignmentType: currentAssignment.assignmentType,
              personnelPosition: dto.personnelPosition ?? currentAssignment.personnelPosition,
              employeeLevel: dto.employeeLevel ?? currentAssignment.employeeLevel,
              personnelCategory: dto.personnelCategory ?? currentAssignment.personnelCategory,
              employmentRelationship: dto.employmentRelationship ?? currentAssignment.employmentRelationship,
              personnelSource: dto.personnelSource ?? currentAssignment.personnelSource,
              workArrangement: dto.workArrangement ?? currentAssignment.workArrangement,
              isPrimary: true,
              startDate: effectiveDate,
              status: AssignmentStatus.ACTIVE,
            },
            select: { id: true },
          });
          const targetOrganization = await tx.organization.findUniqueOrThrow({
            where: { id: dto.organizationId! },
            select: { id: true, code: true, name: true },
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

  private toImportUpdateInput(input: Partial<Record<PersonnelTransferFieldKey, string>>): UpdateEmployeeDto {
    const update: Record<string, string> = {};
    const passthroughFields: PersonnelTransferFieldKey[] = [
      'name', 'workEmail', 'personalEmail', 'mobile', 'documentNumber', 'nativePlace',
      'householdAddress', 'residentialAddress', 'bankBranchName', 'bankAccountNumber',
      'graduationSchoolName', 'major',
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
      if (!code) {
        const title = PERSONNEL_FIELDS.find(({ key }) => key === field)?.title ?? field;
        throw new BadRequestException(`${title} 不支持“${value}”`);
      }
      update[field] = code;
    }
    for (const field of ['birthDate', 'documentExpiryDate', 'graduationDate'] as const) {
      const value = input[field];
      if (value !== undefined) update[field] = this.normalizeImportDate(value, field);
    }
    return update as UpdateEmployeeDto;
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

  private hasImportEmploymentValues(input: Partial<Record<PersonnelTransferFieldKey, string>>) {
    return [
      'organizationName',
      'entryDate',
      'employmentRelationship',
      'workArrangement',
      'employmentStatus',
    ].some((field) => input[field as PersonnelTransferFieldKey] !== undefined);
  }

  private async completeImportedEmployment(
    user: AuthenticatedUser,
    employeeId: string,
    input: Partial<Record<PersonnelTransferFieldKey, string>>,
    profile: UpdateEmployeeDto,
    auditContext: AuditContext,
  ) {
    const requiredFields: Array<[PersonnelTransferFieldKey, string]> = [
      ['organizationName', '部门'],
      ['entryDate', '入职日期'],
      ['employmentRelationship', '雇佣关系'],
      ['workArrangement', '用工形式'],
      ['employmentStatus', '人员状态'],
    ];
    const missing = requiredFields
      .filter(([field]) => input[field] === undefined)
      .map(([, label]) => label);
    if (missing.length > 0) {
      throw new BadRequestException(`补齐任职信息时必须同时提供：${missing.join('、')}`);
    }
    const accessibleOrganizationIds = await this.access.getAccessibleOrganizationIds(user);
    const organizations = await this.prisma.organization.findMany({
      where: {
        name: input.organizationName!,
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        ...(accessibleOrganizationIds === null ? {} : { id: { in: accessibleOrganizationIds } }),
      },
      select: { id: true, code: true, name: true },
      take: 2,
    });
    if (organizations.length !== 1) {
      throw new BadRequestException(
        organizations.length === 0 ? '部门不存在、不在当前范围内或已停用' : '部门名称存在多个有效匹配项，请使用唯一部门名称',
      );
    }
    const organization = organizations[0]!;
    const entryDate = this.toDate(this.normalizeImportDate(input.entryDate!, '入职日期'));
    const employmentRelationship = profile.employmentRelationship;
    const workArrangement = profile.workArrangement;
    const employmentStatus = this.normalizeImportEmploymentStatus(input.employmentStatus!);
    if (!employmentRelationship || !workArrangement || !employmentStatus) {
      throw new BadRequestException('雇佣关系、用工形式或人员状态不支持');
    }

    const warnings: string[] = [];
    const position = await this.resolveImportPosition(input.positionName, warnings);
    const workplace = await this.resolveImportWorkplace(input.workplaceName, warnings);
    await this.prisma.$transaction(async (tx) => {
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
          organizationId: organization.id,
        },
      });
      const period = await tx.employmentPeriod.create({
        data: {
          employeeId,
          sequenceNo: 1,
          personnelCategory: profile.personnelCategory,
          personnelSource: profile.personnelSource,
          employmentRelationship,
          entryDate,
          employmentStatus,
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
          workplaceId: workplace?.id,
          personnelPosition: profile.personnelPosition,
          employeeLevel: profile.employeeLevel,
          personnelCategory: profile.personnelCategory,
          personnelSource: profile.personnelSource,
          employmentRelationship,
          assignmentType: AssignmentType.PRIMARY,
          workArrangement,
          isPrimary: true,
          startDate: entryDate,
          status: AssignmentStatus.ACTIVE,
        },
      });
      await tx.employmentRecord.create({
        data: {
          employeeId,
          employmentPeriodId: period.id,
          status: employmentStatus,
          effectiveAt: entryDate,
          currentFlag: true,
        },
      });
      await tx.employeeFieldChangeLog.create({
        data: {
          employeeId,
          assignmentId: assignment.id,
          changedField: 'organizationId',
          newValue: directoryValue(organization) ?? undefined,
          changedById: auditContext.userId,
        },
      });
      await this.audit.create(auditContext, AuditAction.UPDATE, employeeId, {
        importRow: true,
        completedEmployment: true,
        changedFields: Object.keys(input),
      }, tx);
    });
    return warnings;
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
    const matches = await this.prisma.position.findMany({
      where: { name: value, status: RecordStatus.ACTIVE, archivedAt: null },
      select: { id: true },
      take: 2,
    });
    if (matches.length === 1) return matches[0]!;
    warnings.push(matches.length === 0 ? `职位“${value}”不存在，未导入` : `职位“${value}”匹配多个目录项，未导入`);
    return null;
  }

  private async resolveImportWorkplace(value: string | undefined, warnings: string[]) {
    if (!value) return null;
    const matches = await this.prisma.workplace.findMany({
      where: { name: value, status: RecordStatus.ACTIVE, archivedAt: null },
      select: { id: true },
      take: 2,
    });
    if (matches.length === 1) return matches[0]!;
    warnings.push(matches.length === 0 ? `工作地点“${value}”不存在，未导入` : `工作地点“${value}”匹配多个目录项，未导入`);
    return null;
  }

  private async createPartialImportedEmployee(
    user: AuthenticatedUser,
    input: Partial<Record<PersonnelTransferFieldKey, string>>,
    auditContext: AuditContext,
  ) {
    const employeeNo = input.employeeNo?.trim();
    if (!employeeNo || !/^[A-Za-z0-9_-]{1,32}$/.test(employeeNo)) {
      throw new BadRequestException('工号只能包含字母、数字、下划线和连字符，且长度不超过 32 位');
    }
    const organizationName = input.organizationName?.trim();
    let organizationId: string | undefined;
    if (organizationName) {
      const accessibleOrganizationIds = await this.access.getAccessibleOrganizationIds(user);
      const organization = await this.prisma.organization.findFirst({
        where: {
          name: organizationName,
          status: RecordStatus.ACTIVE,
          archivedAt: null,
          ...(accessibleOrganizationIds === null ? {} : { id: { in: accessibleOrganizationIds } }),
        },
        select: { id: true },
      });
      if (!organization) throw new BadRequestException('部门不存在、不在当前范围内或已停用');
      organizationId = organization.id;
    }

    const profile = this.toImportUpdateInput(input);
    const documentType = profile.documentType;
    const documentNumber = input.documentNumber?.toUpperCase();
    if ((documentType && !documentNumber) || (!documentType && documentNumber)) {
      throw new BadRequestException('证件类型和证件号码必须同时提供');
    }
    await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          employeeNo,
          name: profile.name ?? null,
          mobile: profile.mobile ?? null,
          workEmail: profile.workEmail,
          personalEmail: profile.personalEmail,
          gender: profile.gender as never,
          birthDate: profile.birthDate ? this.toDate(profile.birthDate) : undefined,
          ethnicity: profile.ethnicity as never,
          maritalStatus: profile.maritalStatus as never,
          politicalStatus: profile.politicalStatus as never,
          nativePlace: profile.nativePlace,
          nativePlaceRegionCode: profile.nativePlaceRegionCode,
          householdType: profile.householdType as never,
          householdRegionCode: profile.householdRegionCode,
          householdAddress: profile.householdAddress,
          residentialRegionCode: profile.residentialRegionCode,
          residentialAddress: profile.residentialAddress,
          bankName: profile.bankName as never,
          bankBranchName: profile.bankBranchName,
          bankAccountNumber: profile.bankAccountNumber,
          organizationId,
          idCardNo: documentType === 'NATIONAL_ID' ? documentNumber : undefined,
        },
      });
      if (documentType && documentNumber) {
        await tx.employeeIdentityDocument.create({
          data: {
            employeeId: employee.id,
            documentType: documentType as never,
            documentNumber,
            expiryDate: profile.documentExpiryDate ? this.toDate(profile.documentExpiryDate) : undefined,
            isPrimary: true,
            status: RecordStatus.ACTIVE,
          },
        });
      }
      await this.audit.create(
        auditContext,
        AuditAction.CREATE,
        employee.id,
        { importRow: true, changedFields: Object.keys(input) },
        tx,
      );
    });
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
          archivedAt: null,
        },
      }));
      labels.push('职位不存在、已停用或已归档');
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
    const workplace = input.workplaceId
      ? await tx.workplace.findFirst({
        where: { id: input.workplaceId, status: RecordStatus.ACTIVE, archivedAt: null },
        select: { id: true },
      })
      : null;
    if (input.workplaceId && !workplace) {
      throw new BadRequestException('工作地点不存在或已停用');
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
        workplaceId: workplace?.id,
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
