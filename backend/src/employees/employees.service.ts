import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EmploymentStatus, Prisma } from '@prisma/client';
import type { Paginated } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService, type DemoEmployeeRecord } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { presentEmployee } from './employees.presenter';

const employeeInclude = {
  organization: { select: { name: true } },
  employmentRecords: {
    where: { currentFlag: true },
    select: { status: true },
    take: 1,
  },
} as const;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly audit: AuditService,
    private readonly demo: DemoDataService,
  ) {}

  async findAll(user: AuthenticatedUser, query: QueryEmployeesDto): Promise<Paginated<ReturnType<typeof presentEmployee>>> {
    if (this.demo.enabled) return this.findAllInDemo(user, query);

    const scopeWhere = this.access.getEmployeeWhere(user);
    const conditions: Prisma.EmployeeWhereInput[] = [scopeWhere];

    if (query.organizationId) {
      if (!this.access.canAccessOrganization(user, query.organizationId)) {
        conditions.push({ organizationId: { in: [] } });
      } else {
        conditions.push({ organizationId: query.organizationId });
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
        include: employeeInclude,
        orderBy: [{ employeeNo: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: rows.map((employee) => presentEmployee(employee, user)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(user: AuthenticatedUser, id: string, auditContext: AuditContext) {
    const employee = this.demo.enabled
      ? this.findAccessibleDemoEmployee(user, id)
      : await this.findAccessibleEmployee(user, id);
    await this.audit.create(auditContext, AuditAction.DETAIL_VIEW, id);
    return presentEmployee(employee, user);
  }

  async create(user: AuthenticatedUser, dto: CreateEmployeeDto, auditContext: AuditContext) {
    await this.access.assertOrganizationAccess(user, dto.organizationId);
    if (this.demo.enabled) {
      const employee = this.demo.createEmployee(dto);
      await this.audit.create(
        auditContext,
        AuditAction.CREATE,
        employee.id,
        { changedFields: ['employeeNo', 'name', 'mobile', 'idCardNo', 'organizationId', 'employmentStatus'] },
      );
      return presentEmployee(employee, user);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const employee = await tx.employee.create({
          data: {
            employeeNo: dto.employeeNo,
            name: dto.name,
            mobile: dto.mobile,
            idCardNo: dto.idCardNo.toUpperCase(),
            organizationId: dto.organizationId,
            employmentRecords: {
              create: {
                status: dto.employmentStatus,
                effectiveAt: new Date(),
                currentFlag: true,
              },
            },
          },
          include: employeeInclude,
        });
        await this.audit.create(
          auditContext,
          AuditAction.CREATE,
          employee.id,
          { changedFields: ['employeeNo', 'name', 'mobile', 'idCardNo', 'organizationId', 'employmentStatus'] },
          tx,
        );
        return presentEmployee(employee, user);
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
    const targetOrganizationId = dto.organizationId ?? current.organizationId;
    await this.access.assertOrganizationAccess(user, targetOrganizationId);

    const currentStatus = current.employmentRecords[0]?.status;
    const changedFields = Object.keys(dto).filter((field) => {
      if (field === 'employmentStatus') return dto.employmentStatus !== currentStatus;
      const key = field as keyof typeof current;
      return dto[field as keyof UpdateEmployeeDto] !== current[key];
    });

    if (changedFields.length === 0) return presentEmployee(current, user);

    if (this.demo.enabled) {
      const employee = this.demo.updateEmployee(current as DemoEmployeeRecord, dto);
      await this.audit.create(auditContext, AuditAction.UPDATE, id, { changedFields });
      return presentEmployee(employee, user);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.employmentStatus && dto.employmentStatus !== currentStatus) {
          const changedAt = new Date();
          await tx.employmentRecord.updateMany({
            where: { employeeId: id, currentFlag: true },
            data: { endedAt: changedAt, currentFlag: null },
          });
          await tx.employmentRecord.create({
            data: {
              employeeId: id,
              status: dto.employmentStatus,
              effectiveAt: changedAt,
              currentFlag: true,
            },
          });
        }

        const employee = await tx.employee.update({
          where: { id },
          data: {
            employeeNo: dto.employeeNo,
            name: dto.name,
            mobile: dto.mobile,
            idCardNo: dto.idCardNo?.toUpperCase(),
            organizationId: dto.organizationId,
          },
          include: employeeInclude,
        });
        await this.audit.create(
          auditContext,
          AuditAction.UPDATE,
          id,
          { changedFields },
          tx,
        );
        return presentEmployee(employee, user);
      });
    } catch (error) {
      this.handleUniqueConflict(error);
    }
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
      data: employees.slice(start, start + query.pageSize).map((employee) => presentEmployee(employee, user)),
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
    const employee = await this.prisma.employee.findFirst({
      where: { id, ...this.access.getEmployeeWhere(user) },
      include: employeeInclude,
    });
    if (!employee) throw new NotFoundException('员工不存在或不在当前数据范围内');
    return employee;
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
        throw new ConflictException('身份证号已存在');
      }
      throw new ConflictException('员工唯一信息已存在');
    }
    throw error;
  }
}
