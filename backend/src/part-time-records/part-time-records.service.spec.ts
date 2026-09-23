import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PartTimeRecordStatus, ProcessStatus } from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PartTimeRecordsService } from './part-time-records.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  username: 'hr-editor',
  displayName: '虚构人事',
  role: 'DEPT_ADMIN',
  roleName: '部门管理员',
  permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.EMPLOYEE_UPDATE],
  organizationIds: ['org-scope'],
};

function shanghaiBusinessDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function shiftDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

const today = shanghaiBusinessDate();
const yesterday = shiftDate(today, -1);
const tomorrow = shiftDate(today, 1);
const targetEmployee = {
  id: 'employee-1',
  employeeNo: 'FAKE-1001',
  name: '虚构员工',
};

function createHarness(options: {
  records?: any[];
  employee?: any | null;
  manager?: any | null;
  organization?: any | null;
  approval?: any;
  createResult?: any;
  updateManyCount?: number;
  employeeScope?: any;
} = {}) {
  const records = options.records ?? [];
  const created: any[] = [];
  const updated: any[] = [];
  const partTimeRecord = {
    findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
      if (where?.id) {
        return records.find((record) => record.id === where.id) ?? null;
      }
      return records.find((record) => record.employeeId === where?.employeeId) ?? null;
    }),
    findMany: jest.fn().mockImplementation(async ({ where }: any = {}) => {
      return records.filter((record) => {
        if (where.employeeId && record.employeeId !== where.employeeId) return false;
        if (where.organizationId && record.organizationId !== where.organizationId) return false;
        if (where.institution !== undefined && record.institution !== where.institution) return false;
        if (where.jobTitleId !== undefined && record.jobTitleId !== where.jobTitleId) return false;
        if (where.archivedAt === null && record.archivedAt !== null) return false;
        if (where.status?.in && !where.status.in.includes(record.status)) return false;
        if (where.startDate?.lte && record.startDate > where.startDate.lte) return false;
        if (where.OR && !where.OR.some((condition: any) => (
          condition.endDate === null
            ? record.endDate === null
            : record.endDate !== null && record.endDate >= condition.endDate.gte
        ))) return false;
        return true;
      });
    }),
    count: jest.fn().mockResolvedValue(records.length),
    create: jest.fn().mockImplementation(async ({ data }: any) => {
      const result = options.createResult ?? {
        id: 'part-time-1',
        ...data,
        approvalRequestId: data.approvalRequestId ?? null,
        archivedAt: data.archivedAt ?? null,
      };
      records.push(result);
      created.push(result);
      return result;
    }),
    updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
      const matching = records.filter((record) => (
        record.id === where.id
        && Object.entries(where).every(([key, value]) => key === 'id' || value === undefined || record[key] === value)
      ));
      const count = options.updateManyCount ?? (matching.length > 0 ? 1 : 0);
      matching.slice(0, count).forEach((record) => Object.assign(record, data));
      updated.push({ where, data, count });
      return { count };
    }),
  };
  const tx = {
    partTimeRecord,
    employee: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where?.id === 'manager-1') return options.manager === undefined ? { id: 'manager-1' } : options.manager;
        if (where?.id === targetEmployee.id) return options.employee === undefined ? targetEmployee : options.employee;
        return null;
      }),
    },
    organization: {
      findFirst: jest.fn().mockResolvedValue(options.organization ?? { id: 'org-target' }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((operation: any) => Array.isArray(operation)
      ? Promise.all(operation)
      : operation(tx)),
  };
  const access = {
    hasAllEmployeeData: jest.fn().mockReturnValue(false),
    getEmployeeWhere: jest.fn().mockResolvedValue(options.employeeScope ?? {
      assignments: { some: { organizationId: { in: ['org-scope'] } } },
    }),
    assertOrganizationAccess: jest.fn().mockResolvedValue(undefined),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-scope', 'org-child']),
    getOrganizationSubtreeIds: jest.fn().mockResolvedValue(['org-target']),
  };
  const runtime = {
    createRequest: jest.fn().mockResolvedValue({
      id: 'approval-1',
      businessType: 'PART_TIME_RECORD',
      businessId: 'part-time-1',
      status: ProcessStatus.PENDING,
    }),
    createRequestInTransaction: jest.fn().mockResolvedValue({
      id: 'approval-1',
      businessType: 'PART_TIME_RECORD',
      businessId: 'part-time-1',
      status: ProcessStatus.PENDING,
    }),
    completeEffective: jest.fn().mockResolvedValue({
      id: 'approval-1',
      status: ProcessStatus.COMPLETED,
    }),
    completeEffectiveInTransaction: jest.fn().mockResolvedValue({
      id: 'approval-1',
      status: ProcessStatus.COMPLETED,
    }),
  };
  const audit = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new PartTimeRecordsService(
    prisma as never,
    access as never,
    runtime as never,
    audit as never,
  );

  return { service, prisma, tx, access, runtime, audit, created, updated, records };
}

function createDto(overrides: Record<string, unknown> = {}) {
  return {
    employeeId: targetEmployee.id,
    type: '顾问',
    institution: null,
    organizationId: 'org-target',
    jobTitleId: null,
    managerEmployeeId: null,
    startDate: today,
    endDate: null,
    ...overrides,
  };
}

function activeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'part-time-1',
    employeeId: targetEmployee.id,
    type: '顾问',
    institution: null,
    organizationId: 'org-target',
    jobTitleId: null,
    managerEmployeeId: null,
    startDate: new Date(`${today}T00:00:00.000Z`),
    endDate: null,
    status: PartTimeRecordStatus.ACTIVE,
    approvalRequestId: 'approval-1',
    archivedAt: null,
    employee: targetEmployee,
    organization: { id: 'org-target', name: '虚构部门' },
    jobTitle: null,
    managerEmployee: null,
    approvalRequest: {
      id: 'approval-1',
      status: ProcessStatus.COMPLETED,
      employmentStatus: 'COMPLETED',
    },
    ...overrides,
  };
}

describe('PartTimeRecordsService', () => {
  describe('create', () => {
    it('creates an additional-duty record and binds the task-specific published approval without writing a primary assignment', async () => {
      const harness = createHarness();

      const result = await harness.service.create(user, createDto());

      expect(result).toEqual(expect.objectContaining({
        id: 'part-time-1',
        status: PartTimeRecordStatus.PENDING,
        approvalRequestId: 'approval-1',
      }));
      expect(harness.runtime.createRequestInTransaction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        businessType: 'PART_TIME_RECORD',
        businessId: 'part-time-1',
        applicantUserId: user.id,
      }));
      expect(harness.tx.partTimeRecord.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          employeeId: targetEmployee.id,
          organizationId: 'org-target',
          status: PartTimeRecordStatus.PENDING,
        }),
      }));
      expect((harness.tx as any).employeeAssignment?.updateMany ?? jest.fn()).not.toHaveBeenCalled();
      expect(harness.audit.create).toHaveBeenCalledWith(
        { userId: user.id },
        'CREATE',
        'part-time-1',
        expect.objectContaining({ action: 'create' }),
        expect.anything(),
        'part-time-record',
      );
    });

    it('rejects an overlapping nonterminal record with null institution and job title using the same null semantics', async () => {
      const harness = createHarness({
        records: [activeRecord({
          institution: null,
          jobTitleId: null,
          startDate: new Date(`${yesterday}T00:00:00.000Z`),
          endDate: null,
        })],
      });

      await expect(harness.service.create(user, createDto()))
        .rejects.toBeInstanceOf(ConflictException);
      expect(harness.runtime.createRequest).not.toHaveBeenCalled();
      expect(harness.tx.partTimeRecord.create).not.toHaveBeenCalled();
    });

    it('allows an overlap only when the prior record is terminal', async () => {
      const harness = createHarness({
        records: [activeRecord({ status: PartTimeRecordStatus.ENDED })],
      });

      await expect(harness.service.create(user, createDto())).resolves.toEqual(
        expect.objectContaining({ id: 'part-time-1' }),
      );
    });

    it.each([
      ['archived employee', { employee: null }, NotFoundException],
      ['archived target organization', { organization: null }, NotFoundException],
    ])('rejects an %s', async (_label, options, error) => {
      const harness = createHarness(options as never);
      if (_label === 'archived target organization') {
        harness.access.assertOrganizationAccess.mockRejectedValue(new NotFoundException('部门不存在'));
      }
      await expect(harness.service.create(user, createDto())).rejects.toBeInstanceOf(error);
    });

    it('allows a cross-department active manager but rejects a missing manager and self-manager', async () => {
      const crossDepartment = createHarness();
      await expect(crossDepartment.service.create(user, createDto({ managerEmployeeId: 'manager-1' })))
        .resolves.toEqual(expect.objectContaining({ id: 'part-time-1' }));

      const missingManager = createHarness({ manager: null });
      await expect(missingManager.service.create(user, createDto({ managerEmployeeId: 'manager-1' })))
        .rejects.toBeInstanceOf(BadRequestException);

      const selfManager = createHarness();
      await expect(selfManager.service.create(user, createDto({ managerEmployeeId: targetEmployee.id })))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('validates Shanghai start/end calendar dates and target scope', async () => {
      const beforeToday = createHarness();
      await expect(beforeToday.service.create(user, createDto({ startDate: yesterday })))
        .rejects.toBeInstanceOf(BadRequestException);

      const badRange = createHarness();
      await expect(badRange.service.create(user, createDto({ endDate: yesterday })))
        .rejects.toBeInstanceOf(BadRequestException);

      const outside = createHarness();
      outside.access.assertOrganizationAccess.mockRejectedValue(new ForbiddenException('超出范围'));
      await expect(outside.service.create(user, createDto())).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('activate', () => {
    it('rejects activation before final approval and never calls completeEffective', async () => {
      const harness = createHarness({ records: [activeRecord({
        status: PartTimeRecordStatus.PENDING,
        approvalRequest: {
          id: 'approval-1',
          status: ProcessStatus.PENDING,
          employmentStatus: 'PENDING',
        },
      })] });

      await expect(harness.service.activate(user, 'part-time-1'))
        .rejects.toBeInstanceOf(ConflictException);
      expect(harness.runtime.completeEffectiveInTransaction).not.toHaveBeenCalled();
      expect(harness.tx.partTimeRecord.updateMany).not.toHaveBeenCalled();
    });

    it('moves a finally approved due record to ACTIVE, completes runtime, and audits it', async () => {
      const harness = createHarness({ records: [activeRecord({
        status: PartTimeRecordStatus.PENDING_EFFECTIVE,
        approvalRequest: {
          id: 'approval-1',
          status: ProcessStatus.APPROVED,
          employmentStatus: 'PENDING_EFFECTIVE',
        },
      })] });

      const result = await harness.service.activate(user, 'part-time-1');

      expect(result).toEqual(expect.objectContaining({ id: 'part-time-1', status: PartTimeRecordStatus.ACTIVE }));
      expect(harness.tx.partTimeRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: 'part-time-1',
          status: PartTimeRecordStatus.PENDING_EFFECTIVE,
        }),
        data: { status: PartTimeRecordStatus.ACTIVE },
      }));
      expect(harness.runtime.completeEffectiveInTransaction).toHaveBeenCalledWith(harness.tx, 'approval-1');
      expect(harness.audit.create).toHaveBeenCalledWith(
        { userId: user.id },
        'UPDATE',
        'part-time-1',
        expect.objectContaining({ action: 'activate', toStatus: PartTimeRecordStatus.ACTIVE }),
        expect.anything(),
        'part-time-record',
      );
    });

    it('keeps a future-start approved record pending and makes repeat activation idempotent', async () => {
      const future = createHarness({ records: [activeRecord({
        status: PartTimeRecordStatus.PENDING_EFFECTIVE,
        startDate: new Date(`${tomorrow}T00:00:00.000Z`),
        approvalRequest: { id: 'approval-1', status: ProcessStatus.APPROVED, employmentStatus: 'PENDING_EFFECTIVE' },
      })] });
      await expect(future.service.activate(user, 'part-time-1')).rejects.toBeInstanceOf(ConflictException);
      expect(future.tx.partTimeRecord.updateMany).not.toHaveBeenCalled();

      const active = createHarness({ records: [activeRecord()] });
      await expect(active.service.activate(user, 'part-time-1')).resolves.toEqual(
        expect.objectContaining({ id: 'part-time-1', status: PartTimeRecordStatus.ACTIVE }),
      );
      expect(active.runtime.completeEffectiveInTransaction).not.toHaveBeenCalled();
    });
  });

  describe('end', () => {
    it('ends an active record with a conditional update and preserves the row', async () => {
      const harness = createHarness({ records: [activeRecord()] });

      const result = await harness.service.end(user, 'part-time-1', { endDate: today });

      expect(result).toEqual(expect.objectContaining({ id: 'part-time-1', status: PartTimeRecordStatus.ENDED }));
      expect(harness.tx.partTimeRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'part-time-1', status: PartTimeRecordStatus.ACTIVE }),
        data: expect.objectContaining({ status: PartTimeRecordStatus.ENDED }),
      }));
      expect(harness.audit.create).toHaveBeenCalledWith(
        { userId: user.id },
        'UPDATE',
        'part-time-1',
        expect.objectContaining({ action: 'end', toStatus: PartTimeRecordStatus.ENDED }),
        expect.anything(),
        'part-time-record',
      );
      expect(harness.records[0]).toEqual(expect.objectContaining({
        id: 'part-time-1',
        status: PartTimeRecordStatus.ENDED,
      }));
    });

    it('rejects ending before the start date and rejects concurrent state changes', async () => {
      const badDate = createHarness({ records: [activeRecord()] });
      await expect(badDate.service.end(user, 'part-time-1', { endDate: yesterday }))
        .rejects.toBeInstanceOf(BadRequestException);

      const concurrent = createHarness({ records: [activeRecord()], updateManyCount: 0 });
      await expect(concurrent.service.end(user, 'part-time-1', { endDate: today }))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('returns an already ended record without changing its history', async () => {
      const ended = activeRecord({ status: PartTimeRecordStatus.ENDED, endDate: new Date(`${today}T00:00:00.000Z`) });
      const harness = createHarness({ records: [ended] });

      await expect(harness.service.end(user, 'part-time-1', { endDate: today })).resolves.toEqual(
        expect.objectContaining({ id: 'part-time-1', status: PartTimeRecordStatus.ENDED }),
      );
      expect(harness.tx.partTimeRecord.updateMany).not.toHaveBeenCalled();
      expect(harness.audit.create).not.toHaveBeenCalled();
    });
  });
});
