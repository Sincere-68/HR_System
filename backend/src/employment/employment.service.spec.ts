import {
  ApprovalDecision,
  AssignmentStatus,
  AuditAction,
  EmploymentRelationship,
  EmploymentStatus,
  ProcessStatus,
  RecordStatus,
} from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EmploymentService } from './employment.service';

const user = {
  id: 'user-1', username: 'viewer', displayName: '虚构查看者', role: 'VIEWER' as const,
  roleName: '查看者', permissions: ['employee.read'] as never, organizationIds: ['org-a'],
};
const query = { view: 'all' as const, page: 2, pageSize: 20 };

function createService(demoEnabled = false, rows: unknown[] = []) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const count = jest.fn().mockResolvedValue(rows.length);
  const assignmentFindFirst = jest.fn().mockResolvedValue(null);
  const employeeFindMany = jest.fn().mockResolvedValue(rows.map((row: any) => ({ id: row.employeeId })));
  const prisma = {
    probationRecord: { findMany, count },
    employeeAssignment: { findFirst: assignmentFindFirst },
    employee: { findMany: employeeFindMany },
    $queryRaw: jest.fn().mockResolvedValue(rows.map((row: any) => ({ id: row.id }))),
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const access = {
    hasAllEmployeeData: jest.fn(() => false),
    hasPermission: jest.fn(() => false),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
    getOrganizationSubtreeIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
    getEmployeeWhere: jest.fn().mockResolvedValue({}),
  };
  return {
    service: new EmploymentService(prisma as never, access as never, { enabled: demoEnabled } as never),
    prisma,
    access,
    assignmentFindFirst,
    employeeFindMany,
  };
}

describe('EmploymentService employment records', () => {
  const recordQuery = { view: 'current' as const, page: 1, pageSize: 10 };

  function createRecordService(rows: unknown[] = [], demoEnabled = false) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(rows.length);
    const prisma = {
      employeeAssignment: { findMany, count },
      employee: { findMany: jest.fn().mockResolvedValue(rows.map((row: any) => ({ id: row.employeeId }))) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      hasPermission: jest.fn(() => true),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
      getOrganizationSubtreeIds: jest.fn().mockResolvedValue(['org-child']),
      getEmployeeWhere: jest.fn().mockResolvedValue({}),
    };
    return {
      service: new EmploymentService(prisma as never, access as never, { enabled: demoEnabled } as never),
      findMany,
      count,
      access,
      employeeFindMany: prisma.employee.findMany,
      queryRaw: prisma.$queryRaw,
    };
  }

  it('returns an empty page in demo mode without querying assignments', async () => {
    const { service, findMany } = createRecordService([], true);
    await expect(service.findEmploymentRecords(user, recordQuery)).resolves.toEqual({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('queries one row per authorized current assignment and keeps statuses distinct', async () => {
    const row = {
      id: 'assignment-1', employeeId: 'employee-1', employmentPeriodId: 'period-1', isPrimary: true,
      startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: null,
      status: AssignmentStatus.ACTIVE,
      employmentPeriod: {
        entryDate: new Date('2026-07-15T00:00:00.000Z'),
        employmentRecords: [{
          status: EmploymentStatus.RESIGNED,
          effectiveAt: new Date('2026-07-15T00:00:00.000Z'),
          endedAt: null,
        }],
      },
      employee: {
        employeeNo: 'F-001', name: '虚构员工',
        employmentRecords: [{ status: EmploymentStatus.RESIGNED }],
        convertedCandidates: [{ resumeAttachmentId: 'attachment-1' }],
      },
      organization: { name: '虚构子部门' }, position: { name: '虚构岗位' },
    };
    const { service, findMany, access } = createRecordService([row]);
    const result = await service.findEmploymentRecords(user, {
      view: 'current', keyword: 'F-001', organizationId: 'org-child',
      personnelStatus: EmploymentStatus.RESIGNED,
      assignmentStatus: AssignmentStatus.ENDED,
      startDateFrom: '2026-08-01', startDateTo: '2026-08-31', page: 2, pageSize: 20,
    });

    expect(access.getOrganizationSubtreeIds).toHaveBeenCalledWith('org-child', ['org-a', 'org-child']);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        { archivedAt: null },
        { organizationId: { in: ['org-child'] } },
        { status: AssignmentStatus.ACTIVE },
        { startDate: { lte: expect.any(Date) } },
        { OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }] },
        { startDate: { gte: new Date('2026-08-01'), lte: new Date('2026-08-31') } },
      ]) },
      select: expect.objectContaining({
        employmentPeriod: { select: {
        entryDate: true,
        employmentRecords: {
          select: { status: true, effectiveAt: true, endedAt: true },
          orderBy: [{ effectiveAt: 'desc' }, { id: 'asc' }],
        },
      } },
        employee: { select: expect.objectContaining({
          employeeNo: true,
          name: true,
          employmentRecords: expect.objectContaining({ where: expect.objectContaining({ currentFlag: true }) }),
          convertedCandidates: { where: { archivedAt: null }, select: { resumeAttachmentId: true } },
        }) },
        organization: { select: { name: true } },
        position: { select: { name: true } },
      }),
      skip: 20,
      take: 20,
    }));
    expect(result.data[0]).toEqual(expect.objectContaining({
      employeeNo: 'F-001', personnelStatus: EmploymentStatus.RESIGNED,
      assignmentStatus: AssignmentStatus.ACTIVE, isLatestPrimaryRecord: true,
      availability: 'AVAILABLE', approvalStatus: null, interviewEvaluation: null,
    }));
  });

  it('computes the latest primary marker without list keyword, date, or status filters', async () => {
    const oldRow = {
      id: 'assignment-old', employeeId: 'employee-1', employmentPeriodId: 'period-1', isPrimary: true,
      startDate: new Date('2025-01-01T00:00:00.000Z'), endDate: new Date('2025-12-31T00:00:00.000Z'),
      status: AssignmentStatus.ENDED,
      employmentPeriod: {
        entryDate: new Date('2025-01-01T00:00:00.000Z'),
        employmentRecords: [{
          status: EmploymentStatus.RESIGNED,
          effectiveAt: new Date('2025-01-01T00:00:00.000Z'),
          endedAt: new Date('2025-12-31T00:00:00.000Z'),
        }],
      },
      employee: {
        employeeNo: 'F-001', name: '虚构历史员工', employmentRecords: [], convertedCandidates: [],
      },
      organization: { name: '虚构部门' }, position: { name: '历史岗位' },
    };
    const { service, findMany } = createRecordService([oldRow]);
    findMany
      .mockResolvedValueOnce([oldRow])
      .mockResolvedValueOnce([{
        id: 'assignment-new', employeeId: 'employee-1', employmentPeriodId: 'period-1',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
      }, {
        id: 'assignment-old', employeeId: 'employee-1', employmentPeriodId: 'period-1',
        startDate: new Date('2025-01-01T00:00:00.000Z'),
      }]);

    const result = await service.findEmploymentRecords(user, {
      view: 'history', keyword: 'F-001', assignmentStatus: AssignmentStatus.ENDED,
      startDateTo: '2025-12-31', page: 1, pageSize: 10,
    });

    expect(findMany.mock.calls[1][0]).toEqual(expect.objectContaining({
      where: { AND: [
        { organizationId: { in: ['org-a', 'org-child'] } },
        { isPrimary: true },
      ] },
    }));
    expect(result.data[0]?.isLatestPrimaryRecord).toBe(false);
    expect(result.data[0]?.personnelStatus).toBe(EmploymentStatus.RESIGNED);
  });

  it('filters historical personnel status by the same period and assignment date', async () => {
    const row = {
      id: 'assignment-period-status', employeeId: 'employee-1', employmentPeriodId: 'period-old', isPrimary: false,
      startDate: new Date('2025-01-01T00:00:00.000Z'), endDate: new Date('2025-06-30T00:00:00.000Z'),
      status: AssignmentStatus.ENDED,
      employmentPeriod: {
        entryDate: new Date('2025-01-01T00:00:00.000Z'),
        employmentRecords: [{
          status: EmploymentStatus.RESIGNED,
          effectiveAt: new Date('2025-01-01T00:00:00.000Z'),
          endedAt: new Date('2025-06-30T00:00:00.000Z'),
        }],
      },
      employee: {
        employeeNo: 'F-001', name: '虚构历史员工', employmentRecords: [], convertedCandidates: [],
      },
      organization: { name: '历史部门' }, position: null,
    };
    const { service, queryRaw } = createRecordService([row]);
    queryRaw.mockResolvedValue([{ id: 'assignment-period-status' }]);

    const result = await service.findEmploymentRecords(user, {
      view: 'history', personnelStatus: EmploymentStatus.RESIGNED, page: 1, pageSize: 10,
    });

    const sql = queryRaw.mock.calls[0][0] as { strings: string[]; values: unknown[] };
    expect(sql.strings.join('?')).toContain('record.employment_period_id = assignment.employment_period_id');
    expect(sql.strings.join('?')).toContain('record.effective_at <= assignment.start_date');
    expect(sql.values).toContain(EmploymentStatus.RESIGNED);
    expect(result.data[0]?.personnelStatus).toBe(EmploymentStatus.RESIGNED);
  });

  it('does not borrow a personnel status from another employment period', async () => {
    const row = {
      id: 'assignment-history', employeeId: 'employee-1', employmentPeriodId: 'period-old', isPrimary: false,
      startDate: new Date('2025-01-01T00:00:00.000Z'), endDate: new Date('2025-06-30T00:00:00.000Z'),
      status: AssignmentStatus.ENDED,
      employmentPeriod: { entryDate: new Date('2025-01-01T00:00:00.000Z'), employmentRecords: [] },
      employee: {
        employeeNo: 'F-001', name: '虚构重新入职员工',
        employmentRecords: [{ status: EmploymentStatus.REGULAR }], convertedCandidates: [],
      },
      organization: { name: '历史部门' }, position: null,
    };
    const { service } = createRecordService([row]);

    const result = await service.findEmploymentRecords(user, {
      view: 'history', page: 1, pageSize: 10,
    });

    expect(result.data[0]?.personnelStatus).toBeNull();
  });

  it('returns an empty page when a requested department is outside the authorized tree', async () => {
    const { service, findMany, access } = createRecordService();
    access.getOrganizationSubtreeIds.mockResolvedValue([]);
    await expect(service.findEmploymentRecords(user, {
      view: 'history', organizationId: 'org-outside', page: 3, pageSize: 20,
    })).resolves.toEqual({ data: [], meta: { page: 3, pageSize: 20, total: 0, totalPages: 0 } });
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('EmploymentService interns', () => {
  const internQuery = { page: 2, pageSize: 20 };

  it('returns an empty page in demo mode without touching Prisma', async () => {
    const findMany = jest.fn();
    const prisma = { employmentPeriod: { findMany }, $transaction: jest.fn() };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      hasPermission: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a']),
    };
    const service = new EmploymentService(prisma as never, access as never, { enabled: true } as never);
    await expect(service.findInterns(user, internQuery)).resolves.toEqual({
      data: [], meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('filters intern periods by current assignment scope and leaves line manager unresolved', async () => {
    const findMany = jest.fn().mockResolvedValue([{
      id: 'period-1', employeeId: 'employee-1',
      entryDate: new Date('2026-08-01T00:00:00.000Z'),
      employee: { name: '虚构实习生', workEmail: 'fictional.intern@example.invalid' },
      assignments: [{ organization: { id: 'org-a', name: '虚构部门' }, position: { name: '虚构岗位' } }],
    }]);
    const count = jest.fn().mockResolvedValue(1);
    const reportingFindFirst = jest.fn();
    const employeeFindMany = jest.fn().mockResolvedValue([{ id: 'employee-1' }]);
    const prisma = {
      employmentPeriod: { findMany, count },
      reportingRelationship: { findFirst: reportingFindFirst },
      employee: { findMany: employeeFindMany },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      hasPermission: jest.fn(() => true),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
      getEmployeeWhere: jest.fn().mockResolvedValue({ assignments: { some: { organizationId: { in: ['org-a'] } } } }),
    };
    const service = new EmploymentService(prisma as never, access as never, { enabled: false } as never);
    const result = await service.findInterns(user, {
      keyword: '虚构', startDateFrom: '2026-08-01', startDateTo: '2026-08-31', page: 2, pageSize: 20,
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        { employmentRelationship: EmploymentRelationship.INTERN },
        { employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] } },
        { actualExitDate: null },
        { archivedAt: null },
      ]) },
      select: expect.objectContaining({
        employee: { select: { name: true, workEmail: true } },
      }),
      skip: 20, take: 20,
    }));
    expect(reportingFindFirst).not.toHaveBeenCalled();
    expect(result.data[0]).toEqual(expect.objectContaining({
      employeeName: '虚构实习生', workEmail: 'fictional.intern@example.invalid', departmentName: '虚构部门', positionName: '虚构岗位',
      startDate: '2026-08-01', managerName: null, internshipOrganizationName: null,
      bankName: null, bankAccountNumber: null, bankBranchName: null,
    }));
  });

  it('treats an assignment ending today as current at any time today', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T15:30:00.000Z'));
    try {
      const findMany = jest.fn().mockResolvedValue([{
        id: 'period-ending-today',
        employeeId: 'employee-ending-today',
        entryDate: new Date('2026-08-01T00:00:00.000Z'),
        employee: { name: '虚构实习生二', workEmail: 'fictional.intern2@example.invalid' },
        assignments: [],
      }]);
      const prisma = {
        employmentPeriod: { findMany, count: jest.fn().mockResolvedValue(1) },
        employee: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-ending-today' }]) },
        $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
      };
      const access = {
        hasAllEmployeeData: jest.fn(() => false),
        hasPermission: jest.fn(() => false),
        getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a']),
        getEmployeeWhere: jest.fn().mockResolvedValue({}),
      };
      const service = new EmploymentService(prisma as never, access as never, { enabled: false } as never);
      const currentAssignment = {
        status: AssignmentStatus.ACTIVE,
        archivedAt: null,
        organizationId: { in: ['org-a'] },
        startDate: { lte: new Date('2026-08-26T00:00:00.000Z') },
        OR: [{ endDate: null }, { endDate: { gte: new Date('2026-08-26T00:00:00.000Z') } }],
      };

      await service.findInterns(user, { page: 1, pageSize: 10 });

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { AND: expect.arrayContaining([
          { assignments: { some: currentAssignment } },
        ]) },
        select: expect.objectContaining({
          assignments: expect.objectContaining({ where: currentAssignment }),
        }),
      }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns the company email without a separate field permission', async () => {
    const findMany = jest.fn().mockResolvedValue([{
      id: 'period-1', employeeId: 'employee-1',
      entryDate: new Date('2026-08-01T00:00:00.000Z'),
      employee: { name: '虚构实习生', workEmail: 'fictional.intern@example.invalid' },
      assignments: [],
    }]);
    const prisma = {
      employmentPeriod: { findMany, count: jest.fn().mockResolvedValue(1) },
      reportingRelationship: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => true),
      hasPermission: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn(),
    };
    const service = new EmploymentService(prisma as never, access as never, { enabled: false } as never);

    const result = await service.findInterns(user, { page: 1, pageSize: 10 });

    expect(result.data[0]).toEqual(expect.objectContaining({ workEmail: 'fictional.intern@example.invalid' }));
  });

  it('queries a resigned internship period and its assignment effective on the exit date', async () => {
    const findMany = jest.fn().mockResolvedValue([{
      id: 'period-intern-resigned',
      employeeId: 'employee-intern-resigned',
      entryDate: new Date('2025-08-01T00:00:00.000Z'),
      actualExitDate: new Date('2026-01-15T00:00:00.000Z'),
      employee: { name: '虚构历史实习生', workEmail: null },
      assignments: [{
        organization: { id: 'org-a', name: '历史实习部门' },
        position: { name: '历史实习职位' },
      }],
    }]);
    const queryRaw = jest.fn().mockResolvedValue([{ id: 'period-intern-resigned' }]);
    const prisma = {
      employmentPeriod: { findMany, count: jest.fn().mockResolvedValue(1) },
      employee: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-intern-resigned' }]) },
      $queryRaw: queryRaw,
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a']),
      getEmployeeWhere: jest.fn().mockResolvedValue({}),
    };
    const service = new EmploymentService(prisma as never, access as never, { enabled: false } as never);

    const result = await service.findInterns(user, { view: 'resigned', page: 1, pageSize: 10 } as never);

    expect(queryRaw).toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        { id: { in: ['period-intern-resigned'] } },
        { actualExitDate: { not: null } },
      ]) },
      select: expect.objectContaining({
        actualExitDate: true,
        assignments: expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
            organizationId: { in: ['org-a'] },
          }),
        }),
      }),
    }));
    expect(result.data[0]).toEqual(expect.objectContaining({
      employeeId: 'employee-intern-resigned',
      departmentName: '历史实习部门',
      positionName: '历史实习职位',
      startDate: '2025-08-01',
    }));
  });

  it('rejects internship conversion views instead of returning the current internship page', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      employmentPeriod: { findMany, count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a']),
    };
    const service = new EmploymentService(prisma as never, access as never, { enabled: false } as never);

    await expect(service.findInterns(user, { view: 'conversion_pending', page: 1, pageSize: 10 } as never))
      .rejects.toMatchObject({
        constructor: ConflictException,
        message: '实习转正中视图暂不可用：尚未确认转换事件来源',
      });
  });
});

describe('EmploymentService labor workers', () => {
  const laborQuery = { page: 2, pageSize: 20 };

  function createLaborService(rows: unknown[] = [], demoEnabled = false) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(rows.length);
    const reportingFindFirst = jest.fn().mockResolvedValue(null);
    const employeeFindMany = jest.fn().mockResolvedValue(
      rows.map((row: any) => ({ id: row.employeeId })),
    );
    const prisma = {
      employmentPeriod: { findMany, count },
      reportingRelationship: { findFirst: reportingFindFirst },
      employee: { findMany: employeeFindMany },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      hasPermission: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
      getEmployeeWhere: jest.fn().mockResolvedValue({ assignments: { some: {} } }),
    };
    return {
      service: new EmploymentService(prisma as never, access as never, { enabled: demoEnabled } as never),
      findMany,
      reportingFindFirst,
      employeeFindMany,
      access,
    };
  }

  it('returns an empty page in demo mode without touching Prisma', async () => {
    const { service, findMany } = createLaborService([], true);
    await expect(service.findLaborWorkers(user, laborQuery)).resolves.toEqual({
      data: [], meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('filters current labor periods and exposes only an in-scope effective assignment', async () => {
    const row = {
      id: 'period-labor-1',
      employeeId: 'employee-labor-1',
      entryDate: new Date('2026-08-01T00:00:00.000Z'),
      employee: {
        employeeNo: 'L-001',
        name: '虚构劳务人员',
        workEmail: 'fictional.labor@example.invalid',
      },
      assignments: [{
        organization: { name: '虚构部门' },
        jobTitle: { name: '虚构职务' },
        workplaceName: '虚构工作地点',
        workArrangement: 'LABOR_EMPLOYMENT',
        }],
    };
    const { service, findMany, reportingFindFirst, access } = createLaborService([row]);
    access.hasPermission.mockReturnValue(true);
    reportingFindFirst.mockResolvedValue({ manager: { name: '虚构经理' } });

    const result = await service.findLaborWorkers(user, {
      keyword: 'L-001', entryDateFrom: '2026-08-01', entryDateTo: '2026-08-31', page: 2, pageSize: 20,
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        { employmentRelationship: EmploymentRelationship.LABOR_WORKER },
        { employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] } },
        { actualExitDate: null },
        { status: RecordStatus.ACTIVE },
        { archivedAt: null },
        { assignments: { some: expect.objectContaining({ organizationId: { in: ['org-a', 'org-child'] } }) } },
      ]) },
      select: expect.objectContaining({
        employee: { select: { employeeNo: true, name: true, workEmail: true } },
        assignments: expect.objectContaining({
          where: expect.objectContaining({ organizationId: { in: ['org-a', 'org-child'] } }),
          take: 1,
          select: {
            organization: { select: { name: true } },
            jobTitle: { select: { name: true } },
            workplaceName: true,
            workArrangement: true,
          },
        }),
      }),
      skip: 20,
      take: 20,
    }));
    expect(reportingFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        employeeId: 'employee-labor-1',
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        startDate: { lte: expect.any(Date) },
      }),
    }));
    expect(access.getEmployeeWhere).toHaveBeenCalledWith(
      user,
      ['org-a', 'org-child'],
      expect.any(Date),
    );
    expect(result.data[0]).toEqual({
      id: 'period-labor-1',
      employeeId: 'employee-labor-1',
      employeeName: '虚构劳务人员',
      workEmail: 'fictional.labor@example.invalid',
      employeeNo: 'L-001',
      entryDate: '2026-08-01',
      departmentName: '虚构部门',
      jobTitleName: '虚构职务',
      workArrangement: 'LABOR_EMPLOYMENT',
      managerName: '虚构经理',
      workplaceName: '虚构工作地点',
      canViewEmployeeDetail: true,
    });
  });

  it('hides a historical manager outside the viewer organization scope while keeping the labor row visible', async () => {
    const row = {
      id: 'period-labor-resigned',
      employeeId: 'employee-labor-resigned',
      entryDate: new Date('2025-08-01T00:00:00.000Z'),
      actualExitDate: new Date('2026-01-15T00:00:00.000Z'),
      employee: {
        employeeNo: 'L-RESIGNED',
        name: '虚构历史劳务人员',
        workEmail: 'fictional.resigned@example.invalid',
      },
      assignments: [{
        startDate: new Date('2025-08-01T00:00:00.000Z'),
        endDate: new Date('2026-01-15T00:00:00.000Z'),
        organization: { name: 'A部门' },
        jobTitle: { name: '历史劳务职务' },
        workplaceName: 'A地点',
        workArrangement: 'LABOR_EMPLOYMENT',
      }],
    };
    const findMany = jest.fn().mockResolvedValue([row]);
    const count = jest.fn().mockResolvedValue(1);
    const queryRaw = jest.fn().mockResolvedValue([{ id: row.id }]);
    const reportingFindFirst = jest.fn().mockResolvedValue({
      managerEmployeeId: 'manager-b-only',
      manager: { name: 'B部门经理' },
    });
    const employeeFindMany = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const prisma = {
      employmentPeriod: { findMany, count },
      reportingRelationship: { findFirst: reportingFindFirst },
      employee: { findMany: employeeFindMany },
      $queryRaw: queryRaw,
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a']),
      getEmployeeWhere: jest.fn().mockResolvedValue({
        assignments: { some: { organizationId: { in: ['org-a'] } } },
      }),
    };
    const service = new EmploymentService(prisma as never, access as never, { enabled: false } as never);

    const result = await service.findLaborWorkers(user, {
      view: 'resigned', page: 1, pageSize: 10,
    } as never);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(expect.objectContaining({
      employeeId: 'employee-labor-resigned',
      departmentName: 'A部门',
      managerName: null,
      canViewEmployeeDetail: false,
    }));
    expect(employeeFindMany).toHaveBeenNthCalledWith(2, {
      where: {
        AND: [
          { id: { in: ['manager-b-only'] } },
          { assignments: { some: { organizationId: { in: ['org-a'] } } } },
        ],
      },
      select: { id: true },
    });
    expect(access.getEmployeeWhere).toHaveBeenLastCalledWith(
      user,
      ['org-a'],
      new Date('2026-01-15T00:00:00.000Z'),
    );
  });

  it('returns the company email without a separate field permission', async () => {
    const row = {
      id: 'period-labor-complete',
      employeeId: 'employee-labor-complete',
      entryDate: new Date('2026-08-01T00:00:00.000Z'),
      employee: {
        employeeNo: 'L-002',
        name: '虚构劳务人员二',
        workEmail: 'fictional.labor2@example.invalid',
      },
      assignments: [],
    };
    const { service } = createLaborService([row]);

    const result = await service.findLaborWorkers(user, { page: 1, pageSize: 10 });

    expect(result.data[0]).toEqual(expect.objectContaining({ workEmail: 'fictional.labor2@example.invalid' }));
  });

  it('disables employee detail when the employee is outside current data scope', async () => {
    const row = {
      id: 'period-labor-no-detail',
      employeeId: 'employee-labor-no-detail',
      entryDate: new Date('2026-08-01T00:00:00.000Z'),
      employee: {
        employeeNo: 'L-003',
        name: '虚构无详情权限劳务人员',
        workEmail: null,
      },
      assignments: [],
    };
    const { service, employeeFindMany } = createLaborService([row]);
    employeeFindMany.mockResolvedValue([]);

    const result = await service.findLaborWorkers(user, { page: 1, pageSize: 10 });

    expect(employeeFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: { in: ['employee-labor-no-detail'] } },
          { assignments: { some: {} } },
        ],
      },
      select: { id: true },
    });
    expect(result.data[0]).toEqual(expect.objectContaining({ canViewEmployeeDetail: false }));
  });

  it('uses an empty organization scope in both list and detail filters', async () => {
    const { service, findMany, employeeFindMany, access } = createLaborService([]);
    access.getAccessibleOrganizationIds.mockResolvedValue([]);

    await service.findLaborWorkers(user, { page: 1, pageSize: 10 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: expect.arrayContaining([{
          assignments: {
            some: expect.objectContaining({ organizationId: { in: [] } }),
          },
        }]),
      },
    }));
    expect(employeeFindMany).not.toHaveBeenCalled();
  });
});

describe('EmploymentService part-time assignments', () => {
  const partTimeQuery = { page: 2, pageSize: 20 };

  function createPartTimeService(rows: unknown[] = [], demoEnabled = false) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(rows.length);
    const employeeFindMany = jest.fn().mockResolvedValue(rows.map((row: any) => ({ id: row.employeeId })));
    const prisma = {
      employeeAssignment: { findMany, count },
      employee: { findMany: employeeFindMany },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const detailWhere = { assignments: { some: {} } };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
      getEmployeeWhere: jest.fn().mockResolvedValue(detailWhere),
    };
    return {
      service: new EmploymentService(prisma as never, access as never, { enabled: demoEnabled } as never),
      findMany,
      count,
      employeeFindMany,
      detailWhere,
    };
  }

  it('returns an empty page in demo mode without querying assignments', async () => {
    const { service, findMany } = createPartTimeService([], true);
    await expect(service.findPartTime(user, partTimeQuery)).resolves.toEqual({
      data: [], meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('queries one row per current in-scope PART_TIME assignment and maps only explicit fields', async () => {
    const row = {
      id: 'assignment-part-time-1', employeeId: 'employee-1',
      startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: new Date('2026-12-31T00:00:00.000Z'),
      status: AssignmentStatus.ACTIVE,
      employee: { employeeNo: 'F-001', name: '虚构兼职员工' },
      organization: { name: '虚构兼职部门' }, jobTitle: { name: '虚构兼职职务' },
    };
    const { service, findMany } = createPartTimeService([row]);
    const result = await service.findPartTime(user, {
      keyword: 'F-001', assignmentType: 'ADDITIONAL',
      startDateFrom: '2026-08-01', startDateTo: '2026-08-31',
      endDateFrom: '2026-12-01', endDateTo: '2026-12-31', page: 2, pageSize: 20,
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        { workArrangement: 'PART_TIME' },
        { status: AssignmentStatus.ACTIVE },
        { archivedAt: null },
        { startDate: { lte: expect.any(Date) } },
        { OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }] },
        { organizationId: { in: ['org-a', 'org-child'] } },
        { assignmentType: 'ADDITIONAL' },
        { startDate: { gte: new Date('2026-08-01'), lte: new Date('2026-08-31') } },
        { endDate: { gte: new Date('2026-12-01'), lte: new Date('2026-12-31') } },
      ]) },
      select: {
        id: true, employeeId: true, startDate: true, endDate: true, status: true,
        employee: { select: { employeeNo: true, name: true } },
        organization: { select: { name: true } },
        jobTitle: { select: { name: true } },
      },
      skip: 20,
      take: 20,
    }));
    expect(result.data[0]).toEqual({
      id: 'assignment-part-time-1', employeeId: 'employee-1', employeeName: '虚构兼职员工', employeeNo: 'F-001',
      partTimeType: null, startDate: '2026-08-01', institutionName: null,
      departmentName: '虚构兼职部门', managerName: null, jobTitleName: '虚构兼职职务',
      endDate: '2026-12-31', assignmentStatus: AssignmentStatus.ACTIVE,
      approvalStatus: null, canViewEmployeeDetail: true,
    });
  });

  it('disables detail when the current employee scope no longer allows it', async () => {
    const row = {
      id: 'assignment-part-time-history', employeeId: 'employee-history',
      startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: null,
      status: AssignmentStatus.ACTIVE,
      employee: { employeeNo: 'F-099', name: '虚构兼职历史员工' },
      organization: { name: '虚构兼职部门' }, jobTitle: null,
    };
    const { service, employeeFindMany, detailWhere } = createPartTimeService([row]);
    employeeFindMany.mockResolvedValue([]);

    const result = await service.findPartTime(user, { page: 1, pageSize: 10 });

    expect(employeeFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: { in: ['employee-history'] } },
          detailWhere,
        ],
      },
      select: { id: true },
    });
    expect(result.data[0]?.canViewEmployeeDetail).toBe(false);
  });

  it('queries ended part-time assignments without copying the active date window', async () => {
    const row = {
      id: 'assignment-part-time-ended', employeeId: 'employee-ended',
      startDate: new Date('2025-01-01T00:00:00.000Z'), endDate: new Date('2025-12-31T00:00:00.000Z'),
      status: AssignmentStatus.ENDED,
      employee: { employeeNo: 'F-100', name: '虚构历史兼职员工' },
      organization: { name: '历史兼职部门' }, jobTitle: null,
    };
    const { service, findMany } = createPartTimeService([row]);

    const result = await service.findPartTime(user, { view: 'ended', page: 1, pageSize: 10 } as never);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        { workArrangement: 'PART_TIME' },
        { status: AssignmentStatus.ENDED },
        { endDate: { lt: expect.any(Date) } },
      ]) },
    }));
    expect(findMany.mock.calls[0][0].where.AND).not.toContainEqual({ startDate: { lte: expect.any(Date) } });
    expect(result.data[0]).toEqual(expect.objectContaining({ assignmentStatus: AssignmentStatus.ENDED }));
  });

  it('rejects the part-time approval view without an application source', async () => {
    const { service } = createPartTimeService();
    await expect(service.findPartTime(user, { view: 'approval_pending', page: 1, pageSize: 10 } as never))
      .rejects.toMatchObject({
        constructor: ConflictException,
        message: '兼职审批中视图暂不可用：尚未确认兼职申请与审批来源',
      });
  });
});

function createProbationWorkflowService(status: ProcessStatus = ProcessStatus.DRAFT) {
  const record = {
    id: 'probation-workflow-1',
    employeeId: 'employee-workflow-1',
    employmentPeriodId: 'period-workflow-1',
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    plannedEndDate: new Date('2026-09-01T00:00:00.000Z'),
    status,
  };
  const tx = {
    probationRecord: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    employmentPeriod: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    employmentRecord: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'employment-record-regular-1' }),
    },
    employeeAssignment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    probationRecord: {
      findFirst: jest.fn().mockResolvedValue(record),
      findMany: jest.fn().mockResolvedValue([record]),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const access = {
    hasAllEmployeeData: jest.fn(() => true),
    getEmployeeWhere: jest.fn().mockResolvedValue({}),
  };
  const audit = { create: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new EmploymentService(prisma as never, access as never, { enabled: false } as never, audit as never),
    prisma,
    tx,
    audit,
    record,
  };
}

describe('EmploymentService probation', () => {
  it('returns the demo probation list without querying Prisma', async () => {
    const record = {
      id: 'demo-probation-1',
      employeeId: 'employee-1',
      organizationId: 'org-a',
      positionName: '虚构职位',
      jobTitleName: '虚构职务',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      plannedEndDate: new Date('2026-11-01T00:00:00.000Z'),
      probationMonths: 3,
      actualEndDate: null,
      evaluationType: 'IN_PROBATION' as const,
      evaluation: '试用表现良好',
      result: null,
      confirmedDate: null,
      extensionCount: 0,
      status: ProcessStatus.IN_PROGRESS,
      approval: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-15T00:00:00.000Z'),
    };
    const demo = {
      enabled: true,
      getProbationRecords: jest.fn(() => [record]),
      getEmployee: jest.fn(() => ({
        employeeNo: 'F-001',
        name: '虚构员工',
        organization: { name: '虚构部门' },
        employmentRecords: [{ status: EmploymentStatus.PROBATION }],
      })),
      getProbationApprover: jest.fn(),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => true),
      hasPermission: jest.fn(() => true),
      canAccessOrganization: jest.fn(() => true),
    };
    const service = new EmploymentService({} as never, access as never, demo as never);

    await expect(service.findProbation(user, {
      view: 'reviewing',
      page: 1,
      pageSize: 10,
    })).resolves.toEqual({
      data: [expect.objectContaining({
        id: 'demo-probation-1',
        employeeNo: 'F-001',
        organizationName: null,
        departmentName: '虚构部门',
        positionName: '虚构职位',
        jobTitleName: '虚构职务',
        evaluationName: '试用中考核',
        evaluationApprovalStatus: ProcessStatus.IN_PROGRESS,
        canManage: true,
      })],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
  });

  it('applies organization scope, list filters, and pagination before querying probation rows', async () => {
    const { service, prisma, access } = createService(false, []);
    prisma.$queryRaw.mockResolvedValue([{ id: 'probation-visible-1' }]);
    access.getOrganizationSubtreeIds = jest.fn().mockResolvedValue(['org-child']);

    await expect(service.findProbation(user, {
      view: 'reviewing',
      organizationId: 'org-parent',
      keyword: 'F-001',
      probationMonths: 3,
      status: ProcessStatus.IN_PROGRESS,
      startDateFrom: '2026-08-01',
      startDateTo: '2026-08-31',
      plannedEndDateFrom: '2026-10-01',
      plannedEndDateTo: '2026-10-31',
      page: 2,
      pageSize: 20,
    })).resolves.toEqual({
      data: [],
      meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
    });

    expect(access.getOrganizationSubtreeIds).toHaveBeenCalledWith(
      'org-parent',
      ['org-a', 'org-child'],
    );
    expect(prisma.probationRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: expect.arrayContaining([
          { archivedAt: null },
          { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
          { id: { in: ['probation-visible-1'] } },
          {
            employee: {
              is: {
                OR: [
                  { employeeNo: { contains: 'F-001' } },
                  { name: { contains: 'F-001' } },
                ],
              },
            },
          },
          { probationMonths: 3 },
          { status: ProcessStatus.IN_PROGRESS },
          { status: ProcessStatus.IN_PROGRESS },
          {
            startDate: {
              gte: new Date('2026-08-01T00:00:00.000Z'),
              lte: new Date('2026-08-31T00:00:00.000Z'),
            },
          },
          {
            plannedEndDate: {
              gte: new Date('2026-10-01T00:00:00.000Z'),
              lte: new Date('2026-10-31T00:00:00.000Z'),
            },
          },
        ]),
      },
      orderBy: [{ plannedEndDate: 'asc' }, { id: 'asc' }],
      skip: 20,
      take: 20,
    }));
  });

  it('keeps the selected view filter when a conflicting status is supplied', async () => {
    const { service, prisma, access } = createService(false, []);
    access.hasAllEmployeeData.mockReturnValue(true);

    await service.findProbation(user, {
      view: 'completed',
      status: ProcessStatus.PENDING,
      page: 1,
      pageSize: 10,
    });

    expect(prisma.probationRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: expect.arrayContaining([
          { status: ProcessStatus.COMPLETED },
          { status: ProcessStatus.PENDING },
        ]),
      },
    }));
  });

  it('includes records expiring today by comparing DATE values from midnight', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 26, 15, 30));
    try {
      const { service, prisma, access } = createService(false, []);
      access.hasAllEmployeeData.mockReturnValue(true);
      await service.findProbation(user, {
        view: 'expiring',
        page: 1,
        pageSize: 10,
      });

      expect(prisma.probationRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          AND: expect.arrayContaining([{
            status: ProcessStatus.DRAFT,
            plannedEndDate: {
              gte: new Date('2026-08-26T00:00:00.000Z'),
              lte: new Date('2026-09-25T00:00:00.000Z'),
            },
          }]),
        },
      }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns an empty page before Prisma list queries when no organization is accessible', async () => {
    const { service, prisma, access } = createService(false, []);
    access.getAccessibleOrganizationIds.mockResolvedValue([]);

    await expect(service.findProbation(user, {
      view: 'all',
      page: 3,
      pageSize: 20,
    })).resolves.toEqual({
      data: [],
      meta: { page: 3, pageSize: 20, total: 0, totalPages: 0 },
    });

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.probationRecord.findMany).not.toHaveBeenCalled();
  });

  it('maps a non-empty probation row with its effective assignment and current approver', async () => {
    const row = {
      id: 'probation-mapped-1',
      employeeId: 'employee-mapped-1',
      employmentPeriodId: 'period-mapped-1',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      plannedEndDate: new Date('2026-11-01T00:00:00.000Z'),
      probationMonths: 3,
      actualEndDate: null,
      evaluationType: 'IN_PROBATION',
      result: '建议转正',
      evaluation: '表现符合预期',
      confirmedDate: null,
      extensionCount: 1,
      status: ProcessStatus.PENDING,
      employee: { employeeNo: 'F-001', name: '虚构员工' },
      employmentPeriod: {
        agreements: [{
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          endDate: null,
          terminationDate: null,
          employingCompany: { name: '虚构机构' },
        }],
      },
    };
    const probationRecord = {
      findMany: jest.fn().mockResolvedValue([row]),
      count: jest.fn().mockResolvedValue(1),
    };
    const assignmentFindMany = jest.fn().mockResolvedValue([{
      id: 'assignment-mapped-1',
      employeeId: row.employeeId,
      employmentPeriodId: row.employmentPeriodId,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: null,
      isPrimary: true,
      organization: { name: '虚构部门' },
      position: { name: '虚构职位' },
      jobTitle: { name: '虚构职务' },
    }]);
    const approvalRequest = {
      findMany: jest.fn().mockResolvedValue([{
        businessId: row.id,
        status: ProcessStatus.PENDING,
        currentStep: 1,
        updatedAt: new Date('2026-09-17T00:00:00.000Z'),
        steps: [{
          stepOrder: 1,
          approverUserId: user.id,
          approver: {
            displayName: '虚构审批人',
            employee: { workEmail: 'approver@example.com' },
          },
        }],
      }]),
    };
    const prisma = {
      probationRecord,
      employeeAssignment: { findMany: assignmentFindMany },
      approvalRequest,
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => true),
      hasPermission: jest.fn(() => true),
    };
    const service = new EmploymentService(prisma as never, access as never, { enabled: false } as never);

    const result = await service.findProbation(user, {
      view: 'approval',
      page: 1,
      pageSize: 10,
    });

    expect(assignmentFindMany).toHaveBeenCalledTimes(1);
    expect(assignmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        employmentPeriodId: { in: [row.employmentPeriodId] },
        archivedAt: null,
        startDate: { lte: row.startDate },
        OR: [{ endDate: null }, { endDate: { gte: row.startDate } }],
      }),
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
    }));
    expect(result).toEqual({
      data: [expect.objectContaining({
        id: row.id,
        employeeNo: 'F-001',
        employeeName: '虚构员工',
        organizationName: '虚构机构',
        departmentName: '虚构部门',
        positionName: '虚构职位',
        jobTitleName: '虚构职务',
        startDate: '2026-08-01',
        plannedEndDate: '2026-11-01',
        evaluationName: '试用中考核',
        evaluation: '表现符合预期',
        result: '建议转正',
        approvalStatus: ProcessStatus.PENDING,
        currentApproverName: '虚构审批人(approver@example.com)',
        canManage: true,
        canRemindApproval: true,
        canTransferApproval: true,
      })],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
  });

  it('extends an editable probation period and records the extension in the audit trail', async () => {
    const { service, tx, audit, record } = createProbationWorkflowService();

    await expect(service.updateProbation(user, record.id, {
      plannedEndDate: '2026-09-30',
    })).resolves.toEqual({ id: record.id });

    expect(tx.probationRecord.updateMany).toHaveBeenCalledWith({
      where: { id: record.id, status: ProcessStatus.DRAFT, archivedAt: null },
      data: {
        plannedEndDate: new Date('2026-09-30T00:00:00.000Z'),
        extensionCount: { increment: 1 },
      },
    });
    expect(audit.create).toHaveBeenCalledWith(
      { userId: user.id },
      AuditAction.UPDATE,
      record.id,
      expect.objectContaining({ action: 'update-dates', isExtension: true }),
      tx,
      'probation_record',
    );
  });

  it.each([
    ['update dates', ProcessStatus.COMPLETED, (service: EmploymentService) => (
      service.updateProbation(user, 'probation-workflow-1', { plannedEndDate: '2026-09-30' })
    )],
    ['start evaluation', ProcessStatus.PENDING, (service: EmploymentService) => (
      service.startProbationEvaluation(user, 'probation-workflow-1')
    )],
    ['submit confirmation', ProcessStatus.PENDING, (service: EmploymentService) => (
      service.submitProbationConfirmation(user, 'probation-workflow-1', {
        evaluation: '建议转正',
        approverUserId: 'approver-1',
      })
    )],
    ['approve confirmation', ProcessStatus.DRAFT, (service: EmploymentService) => (
      service.approveProbation(user, 'probation-workflow-1')
    )],
    ['remind approval', ProcessStatus.DRAFT, (service: EmploymentService) => (
      service.remindProbationApproval(user, 'probation-workflow-1')
    )],
    ['transfer approval', ProcessStatus.DRAFT, (service: EmploymentService) => (
      service.transferProbationApproval(user, 'probation-workflow-1', { approverUserId: 'approver-2' })
    )],
    ['confirm regular employment', ProcessStatus.PENDING, (service: EmploymentService) => (
      service.confirmProbation(user, 'probation-workflow-1', { confirmedDate: '2026-09-02' })
    )],
    ['return to evaluation', ProcessStatus.DRAFT, (service: EmploymentService) => (
      service.returnProbationToEvaluation(user, 'probation-workflow-1')
    )],
  ])('rejects illegal status transitions before mutating data: %s', async (_action, status, invoke) => {
    const { service, tx } = createProbationWorkflowService(status);

    await expect(invoke(service)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.probationRecord.updateMany).not.toHaveBeenCalled();
  });

  it('rejects invalid probation date edits before opening a transaction', async () => {
    const { service, prisma } = createProbationWorkflowService();

    await expect(service.updateProbation(user, 'probation-workflow-1', {
      startDate: '2026-10-01',
      plannedEndDate: '2026-09-30',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('starts a single probation evaluation only from DRAFT and writes the audit record', async () => {
    const { service, tx, audit, record } = createProbationWorkflowService();

    await expect(service.startProbationEvaluation(user, record.id, {
      evaluationType: 'IN_PROBATION',
    })).resolves.toEqual({ id: record.id });

    expect(tx.probationRecord.updateMany).toHaveBeenCalledWith({
      where: { id: record.id, status: ProcessStatus.DRAFT, archivedAt: null },
      data: { status: ProcessStatus.IN_PROGRESS, evaluationType: 'IN_PROBATION' },
    });
    expect(audit.create).toHaveBeenCalledWith(
      { userId: user.id },
      AuditAction.UPDATE,
      record.id,
      expect.objectContaining({
        action: 'start-evaluation',
        evaluationType: 'IN_PROBATION',
      }),
      tx,
      'probation_record',
    );
  });

  it('deduplicates batch evaluation IDs, applies the employee scope, and fails inaccessible records', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const findMany = jest.fn().mockResolvedValue([
      { id: 'probation-1', status: ProcessStatus.DRAFT },
      { id: 'probation-2', status: ProcessStatus.DRAFT },
    ]);
    const tx = { probationRecord: { updateMany } };
    const prisma = {
      probationRecord: { findMany },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      getEmployeeWhere: jest.fn().mockResolvedValue({ organizationIds: { has: 'org-a' } }),
    };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new EmploymentService(
      prisma as never,
      access as never,
      { enabled: false } as never,
      audit as never,
    );

    await expect(service.startProbationEvaluations(user, {
      probationIds: ['probation-1', 'probation-1', 'probation-2'],
      evaluationType: 'REGULARIZATION',
    })).resolves.toEqual({ updated: 2 });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['probation-1', 'probation-2'] },
        archivedAt: null,
        employee: {
          is: {
            archivedAt: null,
            recordStatus: RecordStatus.ACTIVE,
            organizationIds: { has: 'org-a' },
          },
        },
      },
      select: { id: true, status: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['probation-1', 'probation-2'] },
        status: ProcessStatus.DRAFT,
        archivedAt: null,
      },
      data: { status: ProcessStatus.IN_PROGRESS, evaluationType: 'REGULARIZATION' },
    });

    findMany.mockResolvedValueOnce([{ id: 'probation-1', status: ProcessStatus.DRAFT }]);
    await expect(service.startProbationEvaluations(user, {
      probationIds: ['probation-1', 'probation-outside-scope'],
    })).rejects.toBeInstanceOf(NotFoundException);

    findMany.mockResolvedValueOnce([{ id: 'probation-1', status: ProcessStatus.PENDING }]);
    await expect(service.startProbationEvaluations(user, {
      probationIds: ['probation-1'],
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires update permission before loading selectable probation approvers', async () => {
    const prisma = { user: { findMany: jest.fn() } };
    const access = { hasPermission: jest.fn(() => false) };
    const service = new EmploymentService(prisma as never, access as never, { enabled: false } as never);

    await expect(service.findProbationApprovers(user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('returns only active users eligible to approve probation confirmation', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'approver-1',
            displayName: '审批人',
            employee: { workEmail: 'approver@example.com' },
          },
        ]),
      },
    };
    const access = { hasPermission: jest.fn(() => true) };
    const service = new EmploymentService(prisma as never, access as never, { enabled: false } as never);

    await expect(service.findProbationApprovers(user)).resolves.toEqual([{
      id: 'approver-1',
      displayName: '审批人',
      workEmail: 'approver@example.com',
    }]);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: RecordStatus.ACTIVE,
        archivedAt: null,
      }),
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    }));
  });

  it('starts batch confirmation and creates one approval request for every selected record', async () => {
    const records = [
      {
        id: 'probation-1',
        employeeId: 'employee-1',
        status: ProcessStatus.DRAFT,
        employee: { name: '虚构员工一' },
      },
      {
        id: 'probation-2',
        employeeId: 'employee-2',
        status: ProcessStatus.IN_PROGRESS,
        employee: { name: '虚构员工二' },
      },
    ];
    const approvalRequest = {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'approval-1' }),
    };
    const tx = {
      approvalRequest,
      probationRecord: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'approver-1',
          username: 'admin',
          displayName: '系统管理员',
          role: {
            code: 'ADMIN',
            name: '系统管理员',
            permissions: [
              { permission: { code: PERMISSIONS.EMPLOYEE_UPDATE } },
              { permission: { code: PERMISSIONS.EMPLOYEE_DATA_ALL } },
            ],
          },
          dataScopes: [],
        }),
      },
      employee: { count: jest.fn().mockResolvedValue(2) },
      probationRecord: { findMany: jest.fn().mockResolvedValue(records) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => true),
      getEmployeeWhere: jest.fn(),
    };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new EmploymentService(
      prisma as never,
      access as never,
      { enabled: false } as never,
      audit as never,
    );

    await expect(service.startProbationConfirmations(user, {
      probationIds: ['probation-1', 'probation-1', 'probation-2'],
      approverUserId: 'approver-1',
    })).resolves.toEqual({ updated: 2 });

    expect(tx.probationRecord.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['probation-1', 'probation-2'] },
        status: { in: [ProcessStatus.DRAFT, ProcessStatus.IN_PROGRESS] },
        archivedAt: null,
      },
      data: {
        result: '建议转正',
        status: ProcessStatus.PENDING,
      },
    });
    expect(approvalRequest.create).toHaveBeenCalledTimes(2);
    expect(approvalRequest.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        businessType: 'PROBATION_REGULARIZATION',
        businessId: 'probation-1',
        applicantUserId: user.id,
        title: '虚构员工一转正申请',
        currentStep: 1,
        status: ProcessStatus.PENDING,
        steps: {
          create: {
            stepOrder: 1,
            approverUserId: 'approver-1',
          },
        },
      }),
    });
    expect(audit.create).toHaveBeenCalledWith(
      { userId: user.id },
      AuditAction.UPDATE,
      undefined,
      expect.objectContaining({
        action: 'batch-start-confirmation',
        probationIds: ['probation-1', 'probation-2'],
      }),
      tx,
      'probation_record',
    );
  });

  it('rejects assigning a probation approver who cannot access every selected employee', async () => {
    const records = [{
      id: 'probation-out-of-scope-1',
      employeeId: 'employee-out-of-scope-1',
      status: ProcessStatus.DRAFT,
      employee: { name: '虚构员工' },
    }];
    const tx = {
      approvalRequest: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      probationRecord: { updateMany: jest.fn() },
    };
    const employeeCount = jest.fn().mockResolvedValue(0);
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'approver-out-of-scope',
          username: 'dept-admin',
          displayName: '部门管理员',
          role: {
            code: 'DEPT_ADMIN',
            name: '部门管理员',
            permissions: [{ permission: { code: PERMISSIONS.EMPLOYEE_UPDATE } }],
          },
          dataScopes: [{ organizationId: 'org-other' }],
        }),
      },
      employee: { count: employeeCount },
      probationRecord: { findMany: jest.fn().mockResolvedValue(records) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const access = {
      hasAllEmployeeData: jest.fn((candidate: { id: string }) => candidate.id === user.id),
      getEmployeeWhere: jest.fn().mockResolvedValue({
        assignments: { some: { organizationId: { in: ['org-other'] } } },
      }),
    };
    const service = new EmploymentService(prisma as never, access as never, { enabled: false } as never);

    await expect(service.startProbationConfirmations(user, {
      probationIds: ['probation-out-of-scope-1'],
      approverUserId: 'approver-out-of-scope',
    })).rejects.toMatchObject({
      message: '所选转正审批人不具备全部相关员工的数据权限',
    });

    expect(employeeCount).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: ['employee-out-of-scope-1'] },
      }),
    });
    expect(tx.probationRecord.updateMany).not.toHaveBeenCalled();
  });

  it('closes the pending approval node before returning a regularization request to evaluation', async () => {
    const record = {
      id: 'probation-return-1',
      employeeId: 'employee-return-1',
      employmentPeriodId: 'period-return-1',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      plannedEndDate: new Date('2026-09-01T00:00:00.000Z'),
      status: ProcessStatus.PENDING,
      employee: { name: '虚构员工' },
    };
    const approvalStep = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
    const approvalRequest = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'approval-return-1',
        currentStep: 1,
        steps: [{ id: 'approval-step-return-1', stepOrder: 1, approverUserId: user.id }],
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const probationRecord = {
      findFirst: jest.fn().mockResolvedValue(record),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const tx = { approvalStep, approvalRequest, probationRecord };
    const prisma = {
      probationRecord,
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const access = { hasAllEmployeeData: jest.fn(() => true) };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new EmploymentService(
      prisma as never,
      access as never,
      { enabled: false } as never,
      audit as never,
    );

    await expect(service.returnProbationToEvaluation(user, record.id)).resolves.toEqual({ id: record.id });

    expect(approvalStep.updateMany).toHaveBeenCalledWith({
      where: { id: 'approval-step-return-1', decision: ApprovalDecision.PENDING },
      data: { decision: ApprovalDecision.SKIPPED, operatedAt: expect.any(Date) },
    });
    expect(approvalRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'approval-return-1', status: ProcessStatus.PENDING, archivedAt: null },
      data: { status: ProcessStatus.WITHDRAWN, completedAt: expect.any(Date) },
    });
    expect(probationRecord.updateMany).toHaveBeenCalledWith({
      where: { id: record.id, status: ProcessStatus.PENDING, archivedAt: null },
      data: { status: ProcessStatus.IN_PROGRESS, result: null },
    });
    expect(audit.create).toHaveBeenCalledWith(
      { userId: user.id },
      AuditAction.UPDATE,
      record.id,
      expect.objectContaining({
        action: 'return-to-evaluation',
        approvalRequestId: 'approval-return-1',
      }),
      tx,
      'probation_record',
    );
  });

  it.each(['transferring', 'returning'] as const)(
    'prevents a non-current approver from %s a probation approval',
    async (action) => {
      const record = {
        id: 'probation-authorization-1',
        employeeId: 'employee-authorization-1',
        employmentPeriodId: 'period-authorization-1',
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        plannedEndDate: new Date('2026-09-01T00:00:00.000Z'),
        status: ProcessStatus.PENDING,
        employee: { name: '虚构员工' },
      };
      const approvalStep = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
      const approvalRequest = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'approval-authorization-1',
          currentStep: 1,
          steps: [{
            id: 'approval-step-authorization-1',
            stepOrder: 1,
            approverUserId: 'current-approver',
          }],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      };
      const probationRecord = {
        findFirst: jest.fn().mockResolvedValue(record),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      };
      const tx = { approvalStep, approvalRequest, probationRecord };
      const prisma = {
        user: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'approver-2',
            username: 'approver-2',
            displayName: '虚构审批人',
            role: {
              code: 'ADMIN',
              name: '系统管理员',
              permissions: [
                { permission: { code: PERMISSIONS.EMPLOYEE_UPDATE } },
                { permission: { code: PERMISSIONS.EMPLOYEE_DATA_ALL } },
              ],
            },
            dataScopes: [],
          }),
        },
        employee: { count: jest.fn().mockResolvedValue(1) },
        probationRecord,
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      };
      const access = { hasAllEmployeeData: jest.fn(() => true) };
      const service = new EmploymentService(
        prisma as never,
        access as never,
        { enabled: false } as never,
      );
      const otherMaintainer = { ...user, id: 'other-maintainer' };

      const operation = action === 'transferring'
        ? service.transferProbationApproval(otherMaintainer, record.id, { approverUserId: 'approver-2' })
        : service.returnProbationToEvaluation(otherMaintainer, record.id);

      await expect(operation).rejects.toBeInstanceOf(ForbiddenException);

      expect(approvalStep.updateMany).not.toHaveBeenCalled();
      expect(approvalRequest.updateMany).not.toHaveBeenCalled();
      expect(probationRecord.updateMany).not.toHaveBeenCalled();
    },
  );
});

describe('EmploymentService trial posts', () => {
  const trialQuery = { page: 1, pageSize: 10 };

  function createTrialService(rows: unknown[] = [], demoEnabled = false) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(rows.length);
    const employeeFindMany = jest.fn().mockResolvedValue(rows.map((row: any) => ({ id: row.employeeId })));
    const prisma = {
      trialPostRecord: { findMany, count },
      employee: { findMany: employeeFindMany },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      hasPermission: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
      getEmployeeWhere: jest.fn().mockResolvedValue({ assignments: { some: { organizationId: { in: ['org-a', 'org-child'] } } } }),
    };
    return {
      service: new EmploymentService(prisma as never, access as never, { enabled: demoEnabled } as never),
      findMany,
      count,
      employeeFindMany,
      access,
    };
  }

  it('returns an empty page in demo mode without querying TrialPostRecord', async () => {
    const { service, findMany } = createTrialService([], true);
    await expect(service.findTrialPosts(user, trialQuery)).resolves.toEqual({ data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('filters by current employee scope and dates while returning the result', async () => {
    const row = {
      id: 'trial-1', employeeId: 'employee-1',
      startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: new Date('2026-08-31T00:00:00.000Z'),
      result: '通过', status: ProcessStatus.COMPLETED,
      employee: { employeeNo: 'F-001', name: '虚构员工' },
      targetPosition: { organization: { id: 'org-a', name: '虚构部门' } },
    };
    const { service, findMany, access } = createTrialService([row]);
    const result = await service.findTrialPosts(user, {
      keyword: 'F-001', status: ProcessStatus.COMPLETED,
      startDateFrom: '2026-08-01', endDateTo: '2026-09-01', page: 2, pageSize: 20,
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.arrayContaining([
        { archivedAt: null },
        { status: ProcessStatus.COMPLETED },
        { startDate: { gte: new Date('2026-08-01') } },
        { endDate: { lte: new Date('2026-09-01') } },
      ]) }),
      skip: 20, take: 20,
    }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        { targetPosition: { is: { organizationId: { in: ['org-a', 'org-child'] } } } },
      ]) },
    }));
    expect(result.data[0]).toEqual(expect.objectContaining({
      employeeNo: 'F-001', startDate: '2026-08-01', endDate: '2026-08-31',
      departmentName: '虚构部门', result: '通过', jobTitleName: null, movementTypeName: null,
      canViewEmployeeDetail: true,
    }));
  });

  it('filters failed trial posts by the explicit result without rewriting process status', async () => {
    const row = {
      id: 'trial-failed', employeeId: 'employee-failed',
      startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: new Date('2026-08-31T00:00:00.000Z'),
      result: '不通过', status: ProcessStatus.COMPLETED,
      employee: { employeeNo: 'F-FAILED', name: '虚构未通过员工' },
      targetPosition: { organization: { id: 'org-a', name: '虚构部门' } },
    };
    const { service, findMany } = createTrialService([row]);

    const result = await service.findTrialPosts(user, {
      view: 'failed', page: 1, pageSize: 10,
    } as never);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([{ result: '不通过' }]) },
    }));
    expect(findMany.mock.calls[0][0].where.AND).not.toContainEqual({ status: ProcessStatus.REJECTED });
    expect(result.data[0]).toEqual(expect.objectContaining({ result: '不通过', status: ProcessStatus.COMPLETED }));
  });

  it('keeps a historically visible trial post but disables detail outside current scope', async () => {
    const row = {
      id: 'trial-history', employeeId: 'employee-history',
      startDate: new Date('2025-08-01T00:00:00.000Z'), endDate: new Date('2025-08-31T00:00:00.000Z'),
      result: '通过', status: ProcessStatus.COMPLETED,
      employee: { employeeNo: 'F-099', name: '虚构历史员工' },
      targetPosition: { organization: { id: 'org-a', name: '历史授权部门' } },
    };
    const { service, employeeFindMany } = createTrialService([row]);
    employeeFindMany.mockResolvedValue([]);

    const result = await service.findTrialPosts(user, trialQuery);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(expect.objectContaining({
      departmentName: '历史授权部门',
      canViewEmployeeDetail: false,
    }));
  });
});

describe('EmploymentService terminations', () => {
  const terminationQuery = { view: 'all' as const, page: 1, pageSize: 10 };

  function createTerminationService(rows: unknown[] = [], demoEnabled = false) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(rows.length);
    const assignmentFindFirst = jest.fn().mockResolvedValue(null);
    const employeeFindMany = jest.fn().mockResolvedValue(rows.map((row: any) => ({ id: row.employeeId })));
    const queryRaw = jest.fn().mockResolvedValue(rows.map((row: any) => ({ id: row.id })));
    const prisma = {
      terminationRecord: { findMany, count },
      employeeAssignment: { findFirst: assignmentFindFirst },
      employee: { findMany: employeeFindMany },
      $queryRaw: queryRaw,
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const employeeWhere = { assignments: { some: { organizationId: { in: ['org-a', 'org-child'] } } } };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      hasPermission: jest.fn(() => true),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
      getEmployeeWhere: jest.fn().mockResolvedValue(employeeWhere),
    };
    return {
      service: new EmploymentService(prisma as never, access as never, { enabled: demoEnabled } as never),
      findMany,
      assignmentFindFirst,
      employeeFindMany,
      queryRaw,
      employeeWhere,
      access,
    };
  }

  it('returns an empty page in demo mode without querying termination records', async () => {
    const { service, findMany } = createTerminationService([], true);
    await expect(service.findTerminations(user, terminationQuery)).resolves.toEqual({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('intersects the active view with an explicit status filter', async () => {
    const { service, findMany, queryRaw } = createTerminationService();
    queryRaw.mockResolvedValue([{ id: 'visible-termination' }]);
    await service.findTerminations(user, {
      view: 'active', status: ProcessStatus.COMPLETED, page: 1, pageSize: 10,
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        { status: { in: [ProcessStatus.PENDING, ProcessStatus.IN_PROGRESS] } },
        { status: ProcessStatus.COMPLETED },
      ]) },
    }));
  });

  it('intersects the completed view with an explicit status filter', async () => {
    const { service, findMany, queryRaw } = createTerminationService();
    queryRaw.mockResolvedValue([{ id: 'visible-termination' }]);
    await service.findTerminations(user, {
      view: 'completed', status: ProcessStatus.APPROVED, page: 1, pageSize: 10,
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        { status: ProcessStatus.COMPLETED },
        { status: ProcessStatus.APPROVED },
      ]) },
    }));
  });

  it('returns an empty page without raw SQL when no organizations are accessible', async () => {
    const { service, findMany, queryRaw, access } = createTerminationService();
    access.getAccessibleOrganizationIds.mockResolvedValue([]);
    const scopedUser = { ...user, organizationIds: [] };
    const result = await service.findTerminations(scopedUser, terminationQuery);
    expect(result).toEqual({ data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
    expect(queryRaw).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('scopes by current assignments and resolves historical assignment at the actual date', async () => {
    const row = {
      id: 'termination-1',
      employeeId: 'employee-1',
      employmentPeriodId: 'period-1',
      plannedLastWorkingDate: new Date('2026-09-30T00:00:00.000Z'),
      actualLastWorkingDate: new Date('2026-09-28T00:00:00.000Z'),
      terminationType: '主动离职',
      reason: '虚构原因',
      status: ProcessStatus.IN_PROGRESS,
      employee: { employeeNo: 'F-001', name: '虚构员工' },
      handoverCase: { archivedAt: null, status: ProcessStatus.IN_PROGRESS },
      approvalRequest: {
        archivedAt: null,
        status: ProcessStatus.PENDING,
        currentStep: 2,
        steps: [{ stepOrder: 2, approver: { displayName: '当前审批人' } }],
      },
    };
    const { service, findMany, assignmentFindFirst, access } = createTerminationService([row]);
    assignmentFindFirst.mockResolvedValue({
      organization: { name: '离职前部门' }, position: { name: '离职前岗位' },
    });

    const result = await service.findTerminations(user, {
      view: 'all', keyword: 'F-001', status: ProcessStatus.IN_PROGRESS,
      lastWorkingDateFrom: '2026-09-01', lastWorkingDateTo: '2026-09-30',
      page: 2, pageSize: 20,
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        { archivedAt: null },
        { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
        { id: { in: ['termination-1'] } },
        { status: ProcessStatus.IN_PROGRESS },
        { OR: [
          { actualLastWorkingDate: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') } },
          { actualLastWorkingDate: null, plannedLastWorkingDate: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') } },
        ] },
      ]) },
      include: expect.objectContaining({
        employee: { select: { employeeNo: true, name: true } },
        approvalRequest: expect.any(Object),
        handoverCase: expect.any(Object),
      }),
      skip: 20,
      take: 20,
    }));
    expect(assignmentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        employeeId: 'employee-1', employmentPeriodId: 'period-1',
        status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
        organizationId: { in: ['org-a', 'org-child'] },
        startDate: { lte: row.actualLastWorkingDate },
        OR: [{ endDate: null }, { endDate: { gte: row.actualLastWorkingDate } }],
        isPrimary: true,
      }),
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
    }));
    expect(access.getEmployeeWhere).toHaveBeenCalledWith(user, ['org-a', 'org-child'], expect.any(Date));
    expect(result.data[0]).toEqual(expect.objectContaining({
      employeeNo: 'F-001', previousDepartmentName: '离职前部门', previousPositionName: '离职前岗位',
      lastWorkingDate: '2026-09-28', lastWorkingDateBasis: 'ACTUAL',
      terminationReason: '虚构原因', approvalStatus: ProcessStatus.PENDING,
      currentApproverName: '当前审批人', handoverStatus: ProcessStatus.IN_PROGRESS,
      compensationAmount: null, canViewEmployeeDetail: true,
    }));
  });

  it('authorizes and displays an archived assignment covering the actual last working date', async () => {
    const row = {
      id: 'termination-archived', employeeId: 'employee-archived', employmentPeriodId: 'period-archived',
      plannedLastWorkingDate: new Date('2025-09-30T00:00:00.000Z'), actualLastWorkingDate: new Date('2025-09-28T00:00:00.000Z'),
      terminationType: '主动离职', reason: null, status: ProcessStatus.COMPLETED,
      employee: { employeeNo: 'F-098', name: '虚构归档员工' }, handoverCase: null, approvalRequest: null,
    };
    const { service, assignmentFindFirst, queryRaw } = createTerminationService([row]);
    assignmentFindFirst.mockResolvedValue({
      organization: { name: '归档历史部门' }, position: { name: '归档历史岗位' },
    });

    const result = await service.findTerminations(user, terminationQuery);

    const authorizationSql = queryRaw.mock.calls[0][0] as { strings: string[]; values: unknown[] };
    expect(authorizationSql.values).toEqual(expect.arrayContaining([
      'org-a', 'org-child', AssignmentStatus.ACTIVE, AssignmentStatus.ENDED,
    ]));
    const authorizationText = authorizationSql.strings.join('?');
    expect(authorizationText).toContain('assignment.employment_period_id = termination.employment_period_id');
    expect(authorizationText).toContain('assignment.start_date <= COALESCE');
    expect(authorizationText).toContain('assignment.end_date >= COALESCE');
    expect(authorizationText).not.toContain('assignment.archived_at IS NULL');
    expect(assignmentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        employeeId: 'employee-archived', employmentPeriodId: 'period-archived',
        status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
        startDate: { lte: row.actualLastWorkingDate },
        OR: [{ endDate: null }, { endDate: { gte: row.actualLastWorkingDate } }],
        isPrimary: true,
      }),
    }));
    expect(assignmentFindFirst.mock.calls[0][0].where).not.toHaveProperty('archivedAt');
    expect(result.data[0]).toEqual(expect.objectContaining({
      previousDepartmentName: '归档历史部门', previousPositionName: '归档历史岗位',
    }));
  });

  it('disables detail for employees outside the current organization scope', async () => {
    const row = {
      id: 'termination-history', employeeId: 'employee-history', employmentPeriodId: 'period-history',
      plannedLastWorkingDate: new Date('2025-09-30T00:00:00.000Z'), actualLastWorkingDate: new Date('2025-09-30T00:00:00.000Z'),
      terminationType: '主动离职', reason: null, status: ProcessStatus.COMPLETED,
      employee: { employeeNo: 'F-099', name: '虚构历史员工' }, handoverCase: null, approvalRequest: null,
    };
    const { service, employeeFindMany } = createTerminationService([row]);
    employeeFindMany.mockResolvedValue([]);
    const result = await service.findTerminations(user, terminationQuery);
    expect(result.data[0]?.canViewEmployeeDetail).toBe(false);
  });

  it('returns reason and approver while keeping process states', async () => {
    const row = {
      id: 'termination-2', employeeId: 'employee-2', employmentPeriodId: null,
      plannedLastWorkingDate: new Date('2026-10-01T00:00:00.000Z'), actualLastWorkingDate: null,
      terminationType: '协商解除', reason: '虚构离职原因', status: ProcessStatus.PENDING,
      employee: { employeeNo: 'F-002', name: '虚构员工二' }, handoverCase: null,
      approvalRequest: { archivedAt: null, status: ProcessStatus.PENDING, currentStep: 1, steps: [{ stepOrder: 1, approver: { displayName: '虚构审批人' } }] },
    };
    const { service, access } = createTerminationService([row]);
    access.hasPermission.mockReturnValue(false);
    const result = await service.findTerminations(user, terminationQuery);
    expect(result.data[0]).toEqual(expect.objectContaining({
      lastWorkingDate: '2026-10-01', lastWorkingDateBasis: 'PLANNED',
      terminationReason: '虚构离职原因', approvalStatus: ProcessStatus.PENDING,
      currentApproverName: '虚构审批人', handoverStatus: null,
    }));
  });
});

describe('EmploymentService retirements', () => {
  const retirementQuery = { page: 1, pageSize: 10 };

  function createRetirementService(rows: unknown[] = [], demoEnabled = false) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(rows.length);
    const assignmentFindFirst = jest.fn().mockResolvedValue(null);
    const employeeWhere = { assignments: { some: { organizationId: { in: ['org-a', 'org-child'] } } } };
    const employeeFindMany = jest.fn().mockResolvedValue(
      rows.map((row: any) => ({ id: row.employeeId })),
    );
    const queryRaw = jest.fn().mockResolvedValue(rows.map((row: any) => ({ id: row.id })));
    const prisma = {
      retirementRecord: { findMany, count },
      employeeAssignment: { findFirst: assignmentFindFirst },
      employee: { findMany: employeeFindMany },
      $queryRaw: queryRaw,
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      hasPermission: jest.fn(() => true),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
      getEmployeeWhere: jest.fn().mockResolvedValue(employeeWhere),
      getOrganizationSubtreeIds: jest.fn().mockResolvedValue(['org-child']),
    };
    return {
      service: new EmploymentService(prisma as never, access as never, { enabled: demoEnabled } as never),
      findMany,
      assignmentFindFirst,
      employeeFindMany,
      employeeWhere,
      access,
      queryRaw,
    };
  }

  it('returns an empty page in demo mode without querying retirement records', async () => {
    const { service, findMany } = createRetirementService([], true);
    await expect(service.findRetirements(user, retirementQuery)).resolves.toEqual({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('filters real RetirementRecord fields and displays its date-effective in-scope primary assignment', async () => {
    const row = {
      id: 'retirement-1',
      employeeId: 'employee-1',
      employmentPeriodId: 'period-1',
      plannedRetirementDate: new Date('2030-08-24T00:00:00.000Z'),
      employee: {
        employeeNo: 'F-001', name: '虚构员工', gender: 'FEMALE',
        birthDate: new Date('1970-08-26T00:00:00.000Z'),
      },
    };
    const {
      service,
      findMany,
      assignmentFindFirst,
      employeeFindMany,
      employeeWhere,
      access,
    } = createRetirementService([row]);
    assignmentFindFirst.mockResolvedValue({
      organization: { name: '虚构部门' }, jobTitle: { name: '虚构职务' },
    });

    const result = await service.findRetirements(user, {
      keyword: 'F-001',
      status: ProcessStatus.APPROVED,
      plannedRetirementDateFrom: '2030-08-01',
      plannedRetirementDateTo: '2030-08-31',
      departmentId: 'org-child',
      page: 1,
      pageSize: 20,
    });

    expect(access.getOrganizationSubtreeIds).toHaveBeenCalledWith(
      'org-child',
      ['org-a', 'org-child'],
    );
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        { archivedAt: null },
        { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
        { status: ProcessStatus.APPROVED },
        { plannedRetirementDate: {
          gte: new Date('2030-08-01'), lte: new Date('2030-08-31'),
        } },
        { id: { in: ['retirement-1'] } },
      ]) },
      select: expect.objectContaining({
        plannedRetirementDate: true,
        employee: { select: { employeeNo: true, name: true, gender: true, birthDate: true } },
      }),
      skip: 0,
      take: 20,
    }));
    expect(employeeFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: { in: ['employee-1'] } },
          employeeWhere,
        ],
      },
      select: { id: true },
    });
    expect(assignmentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        employeeId: 'employee-1',
        employmentPeriodId: 'period-1',
        status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
        isPrimary: true,
        organizationId: { in: ['org-child'] },
        startDate: { lte: row.plannedRetirementDate },
        OR: [{ endDate: null }, { endDate: { gte: row.plannedRetirementDate } }],
      }),
      select: {
        organization: { select: { name: true } },
        jobTitle: { select: { name: true } },
      },
    }));
    expect(result.data[0]).toEqual(expect.objectContaining({
      employeeName: '虚构员工',
      employeeNo: 'F-001',
      gender: 'FEMALE',
      birthDate: '1970-08-26',
      plannedRetirementDate: '2030-08-24',
      departmentName: '虚构部门',
      jobTitleName: '虚构职务',
    }));
  });

  it('filters upcoming retirements by the persisted planned date and open status', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T15:30:00.000Z'));
    try {
      const row = {
        id: 'retirement-upcoming', employeeId: 'employee-upcoming',
        plannedRetirementDate: new Date('2026-09-10T00:00:00.000Z'),
        actualRetirementDate: null,
        employee: { employeeNo: 'F-UPCOMING', name: '虚构即将退休员工', gender: null, birthDate: null },
      };
      const { service, findMany, queryRaw } = createRetirementService([row]);

      await service.findRetirements(user, { view: 'upcoming', page: 1, pageSize: 10 } as never);

      expect(queryRaw).toHaveBeenCalled();
      const authorizationSql = queryRaw.mock.calls[0][0] as { strings: string[]; values: unknown[] };
      const authorizationText = authorizationSql.strings.join('?');
      expect(authorizationText).toContain('COALESCE(rr.actual_retirement_date, rr.planned_retirement_date)');
      expect(authorizationSql.values).toEqual(expect.arrayContaining([
        'org-a', 'org-child', AssignmentStatus.ACTIVE, AssignmentStatus.ENDED,
      ]));
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { AND: expect.arrayContaining([{ id: { in: ['retirement-upcoming'] } }]) },
      }));
      expect(findMany.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([
        { plannedRetirementDate: { gte: new Date('2026-08-26T00:00:00.000Z'), lte: new Date('2026-09-25T00:00:00.000Z') } },
        { actualRetirementDate: null },
        { status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.CANCELLED] } },
      ]));
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns retirement fields without a separate field permission', async () => {
    const row = {
      id: 'retirement-2', employeeId: 'employee-2', employmentPeriodId: null,
      plannedRetirementDate: new Date('2031-01-01T00:00:00.000Z'),
      employee: {
        employeeNo: 'F-002', name: '虚构员工二', gender: 'MALE',
        birthDate: new Date('1971-01-01T00:00:00.000Z'),
      },
    };
    const { service, access } = createRetirementService([row]);
    access.hasPermission.mockReturnValue(false);

    const result = await service.findRetirements(user, retirementQuery);

    expect(result.data[0]).toEqual(expect.objectContaining({
      gender: 'MALE',
      age: 55,
      birthDate: '1971-01-01',
      plannedRetirementDate: '2031-01-01',
    }));
  });

  it('authorizes and displays an archived assignment covering the retirement date', async () => {
    const row = {
      id: 'retirement-archived', employeeId: 'employee-archived', employmentPeriodId: 'period-archived',
      plannedRetirementDate: new Date('2025-08-24T00:00:00.000Z'), actualRetirementDate: null,
      employee: {
        employeeNo: 'F-098', name: '虚构归档退休员工', gender: null, birthDate: null,
      },
    };
    const { service, assignmentFindFirst } = createRetirementService([row]);
    assignmentFindFirst.mockResolvedValue({
      organization: { name: '归档历史部门' }, jobTitle: { name: '归档历史职务' },
    });

    const result = await service.findRetirements(user, retirementQuery);

    expect(assignmentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        employeeId: 'employee-archived', employmentPeriodId: 'period-archived',
        status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
        isPrimary: true,
      }),
    }));
    expect(assignmentFindFirst.mock.calls[0][0].where).not.toHaveProperty('archivedAt');
    expect(result.data[0]).toEqual(expect.objectContaining({
      departmentName: '归档历史部门', jobTitleName: '归档历史职务',
    }));
  });

  it('disables detail for a historically visible employee outside current scope', async () => {
    const row = {
      id: 'retirement-history', employeeId: 'employee-history', employmentPeriodId: 'period-history',
      plannedRetirementDate: new Date('2025-08-24T00:00:00.000Z'), actualRetirementDate: null,
      employee: {
        employeeNo: 'F-099', name: '虚构历史退休员工', gender: null, birthDate: null,
      },
    };
    const { service, employeeFindMany } = createRetirementService([row]);
    employeeFindMany.mockResolvedValue([]);

    const result = await service.findRetirements(user, retirementQuery);

    expect(result.data[0]?.canViewEmployeeDetail).toBe(false);
  });

  it('returns an empty page without raw SQL when no organizations are accessible', async () => {
    const { service, findMany, access } = createRetirementService();
    access.getAccessibleOrganizationIds.mockResolvedValue([]);

    await expect(service.findRetirements(user, {
      page: 3, pageSize: 20,
    })).resolves.toEqual({
      data: [], meta: { page: 3, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects retirement intention applications without an independent source', async () => {
    const { service } = createRetirementService();
    await expect(service.findRetirements(user, {
      view: 'intention_application', page: 1, pageSize: 10,
    } as never)).rejects.toMatchObject({
      constructor: ConflictException,
      message: '意向退休日期申请视图暂不可用：尚未接入独立申请来源',
    });
  });

  it('returns an empty page for a department outside the authorized tree', async () => {
    const { service, findMany, access } = createRetirementService();
    access.getOrganizationSubtreeIds.mockResolvedValue([]);

    await expect(service.findRetirements(user, {
      departmentId: 'org-outside', page: 3, pageSize: 20,
    })).resolves.toEqual({
      data: [], meta: { page: 3, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('EmploymentService movements', () => {
  const movementQuery = { view: 'active' as const, page: 1, pageSize: 10 };

  function createMovementService(rows: unknown[] = [], demoEnabled = false) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(rows.length);
    const employeeFindMany = jest.fn().mockResolvedValue(rows.map((row: any) => ({ id: row.employeeId })));
    const prisma = {
      employeeMovement: { findMany, count },
      employee: { findMany: employeeFindMany },
      $queryRaw: jest.fn().mockResolvedValue(rows.map((row: any) => ({ id: row.id }))),
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const employeeWhere = { assignments: { some: { organizationId: { in: ['org-a', 'org-child'] } } } };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      hasPermission: jest.fn(() => true),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
      getEmployeeWhere: jest.fn().mockResolvedValue(employeeWhere),
    };
    return {
      service: new EmploymentService(prisma as never, access as never, { enabled: demoEnabled } as never),
      findMany,
      employeeFindMany,
      prisma,
      employeeWhere,
      access,
    };
  }

  it('returns an empty movement page in demo mode without touching Prisma', async () => {
    const { service, findMany } = createMovementService([], true);
    await expect(service.findMovements(user, { ...movementQuery, view: 'all' })).resolves.toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('scopes movement rows by current assignments and maps only explicit relations', async () => {
    const row = {
      id: 'movement-1',
      employeeId: 'employee-1',
      fromOrganizationId: 'org-outside',
      toOrganizationId: 'org-child',
      effectiveDate: new Date('2026-08-20T00:00:00.000Z'),
      status: ProcessStatus.APPROVED,
      employee: { employeeNo: 'F-001', name: '虚构员工' },
      movementType: { name: '部门调动' },
      fromOrganization: { id: 'org-outside', name: '范围外部门' },
      toOrganization: { id: 'org-child', name: '范围内部门' },
      fromPosition: { name: '范围外岗位' },
      toPosition: { name: '范围内岗位' },
      fromJobLevel: 'S1',
      toJobLevel: 'E1',
      approvalRequest: {
        archivedAt: null,
        status: ProcessStatus.PENDING,
        currentStep: 2,
        steps: [
          { stepOrder: 1, approver: { displayName: '旧审批人' } },
          { stepOrder: 2, approver: { displayName: '当前审批人' } },
        ],
      },
    };
    const { service, findMany, employeeFindMany, prisma, employeeWhere } = createMovementService([row]);

    const result = await service.findMovements(user, {
      view: 'all',
      page: 2,
      pageSize: 20,
      keyword: 'F-001',
      approvalStatus: ProcessStatus.PENDING,
      effectiveDateFrom: '2026-08-01',
      effectiveDateTo: '2026-08-31',
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: expect.arrayContaining([
          { archivedAt: null },
          { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
          { id: { in: ['movement-1'] } },
          { approvalRequestId: { not: null }, approvalRequest: { is: { archivedAt: null, status: ProcessStatus.PENDING } } },
        ]),
      },
      skip: 20,
      take: 20,
      include: expect.objectContaining({
        movementType: { select: { name: true } },
        approvalRequest: expect.objectContaining({
          include: expect.objectContaining({
            steps: expect.objectContaining({ where: { decision: 'PENDING' } }),
          }),
        }),
      }),
    }));
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(employeeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ id: { in: ['employee-1'] } }, employeeWhere] },
      select: { id: true },
    }));
    expect(result.data[0]).toEqual({
      id: 'movement-1',
      employeeId: 'employee-1',
      employeeNo: 'F-001',
      employeeName: '虚构员工',
      effectiveDate: '2026-08-20',
      movementTypeName: '部门调动',
      movementTypeEmployeeName: null,
      movementStatus: ProcessStatus.APPROVED,
      approvalStatus: ProcessStatus.PENDING,
      fromDepartmentName: null,
      fromPositionName: null,
      fromJobLevel: null,
      toDepartmentName: '范围内部门',
      toPositionName: '范围内岗位',
      toJobLevel: 'E1',
      toWorkplaceName: null,
      handoverStatus: null,
      currentApproverName: '当前审批人',
      trialPostEndDate: null,
      canViewEmployeeDetail: true,
    });
    expect(JSON.stringify(result.data[0])).not.toContain('范围外');
  });

  it('keeps a historically scoped movement visible but disables detail outside current scope', async () => {
    const row = {
      id: 'movement-history',
      employeeId: 'employee-history',
      fromOrganizationId: 'org-a',
      toOrganizationId: 'org-outside',
      effectiveDate: new Date('2025-08-20T00:00:00.000Z'),
      status: ProcessStatus.COMPLETED,
      employee: { employeeNo: 'F-099', name: '虚构历史员工' },
      movementType: { name: '部门调动' },
      fromOrganization: { id: 'org-a', name: '历史授权部门' },
      toOrganization: { id: 'org-outside', name: '当前范围外部门' },
      fromPosition: null,
      toPosition: null,
      fromJobLevel: null,
      toJobLevel: null,
      approvalRequest: null,
    };
    const { service, employeeFindMany, access } = createMovementService([row]);
    employeeFindMany.mockResolvedValue([]);

    const result = await service.findMovements(user, { view: 'all', page: 1, pageSize: 10 });

    expect(access.getEmployeeWhere).toHaveBeenCalledWith(
      user,
      ['org-a', 'org-child'],
      expect.any(Date),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(expect.objectContaining({
      fromDepartmentName: '历史授权部门',
      toDepartmentName: null,
      canViewEmployeeDetail: false,
    }));
  });

  it('authorizes organization-less movements through assignments effective on the movement date', async () => {
    const row = {
      id: 'movement-position-only',
      employeeId: 'employee-2',
      fromOrganizationId: null,
      toOrganizationId: null,
      effectiveDate: new Date('2026-08-21T00:00:00.000Z'),
      employee: { employeeNo: 'F-002', name: '虚构员工二' },
      movementType: { name: '职级调整' },
      fromOrganization: null,
      toOrganization: null,
      fromPosition: null,
      toPosition: null,
      fromJobLevel: 'S1',
      toJobLevel: 'E1',
      approvalRequest: null,
      status: ProcessStatus.COMPLETED,
    };
    const { service, prisma } = createMovementService([row]);

    const result = await service.findMovements(user, { ...movementQuery, view: 'all' });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(expect.objectContaining({
      fromJobLevel: null,
      toJobLevel: null,
    }));
  });

  it('returns an empty page before list queries when no historical movement is in scope', async () => {
    const { service, findMany, prisma } = createMovementService([]);
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(service.findMovements(user, { view: 'all', page: 3, pageSize: 20 })).resolves.toEqual({
      data: [],
      meta: { page: 3, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns the current approver without a separate field permission', async () => {
    const row = {
      id: 'movement-approver',
      employeeId: 'employee-1',
      fromOrganizationId: 'org-a',
      toOrganizationId: 'org-child',
      effectiveDate: new Date('2026-08-20T00:00:00.000Z'),
      status: ProcessStatus.APPROVED,
      employee: { employeeNo: 'F-001', name: '虚构员工' },
      movementType: { name: '部门调动' },
      fromOrganization: { id: 'org-a', name: '范围内原部门' },
      toOrganization: { id: 'org-child', name: '范围内新部门' },
      fromPosition: null,
      toPosition: null,
      fromJobLevel: null,
      toJobLevel: null,
      approvalRequest: {
        archivedAt: null,
        status: ProcessStatus.PENDING,
        currentStep: 1,
        steps: [{ stepOrder: 1, approver: { displayName: '虚构审批人' } }],
      },
    };
    const { service, access } = createMovementService([row]);
    access.hasPermission.mockReturnValue(false);

    const result = await service.findMovements(user, { ...movementQuery, view: 'all' });

    expect(result.data[0].approvalStatus).toBe(ProcessStatus.PENDING);
    expect(result.data[0].currentApproverName).toBe('虚构审批人');
  });

  it('keeps business movement status separate and hides approval data when no request is linked', async () => {
    const row = {
      id: 'movement-2',
      employeeId: 'employee-2',
      fromOrganizationId: null,
      toOrganizationId: null,
      effectiveDate: new Date('2026-08-21T00:00:00.000Z'),
      employee: { employeeNo: 'F-002', name: '虚构员工二' },
      movementType: { name: '职级调整' },
      fromOrganization: null,
      toOrganization: null,
      fromPosition: { name: '原岗位' },
      toPosition: { name: '新岗位' },
      fromJobLevel: 'S1',
      toJobLevel: 'E1',
      approvalRequest: null,
      status: ProcessStatus.COMPLETED,
    };
    const { service } = createMovementService([row]);
    const result = await service.findMovements(user, { ...movementQuery, view: 'all' });

    expect(result.data[0]).toEqual(expect.objectContaining({
      approvalStatus: null,
      currentApproverName: null,
      fromPositionName: null,
      toPositionName: null,
      fromJobLevel: null,
      toJobLevel: null,
    }));
  });
});
