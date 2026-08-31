import {
  AssignmentStatus,
  EmploymentRelationship,
  EmploymentStatus,
  RecordStatus,
  ReportingRelationshipType,
} from '@prisma/client';
import { PersonnelLaborWorkersService } from './personnel-labor-workers.service';

const user = {
  id: 'user-1',
  username: 'viewer',
  displayName: '虚构查看者',
  role: 'VIEWER' as const,
  roleName: '查看者',
  permissions: ['employee.read'] as never,
  organizationIds: ['org-a'],
};

type PersonnelLaborWorkerRow = {
  employeeId: string;
  employmentPeriodId: string;
  employee: {
    employeeNo: string;
    name: string;
    workEmail: string | null;
  };
  employmentPeriod: { entryDate: Date } | null;
  organization: { name: string };
  jobTitle: { name: string } | null;
  position: { name: string } | null;
  workArrangement: 'LABOR_EMPLOYMENT';
};

function createService(rows: PersonnelLaborWorkerRow[] = [], demoEnabled = false) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const count = jest.fn().mockResolvedValue(rows.length);
  const reportingFindFirst = jest.fn().mockResolvedValue(null);
  const employeeFindMany = jest.fn().mockResolvedValue(
    rows.map(({ employeeId }) => ({ id: employeeId })),
  );
  const prisma = {
    employeeAssignment: { findMany, count },
    reportingRelationship: { findFirst: reportingFindFirst },
    employee: { findMany: employeeFindMany },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const detailWhere = {
    assignments: { some: { organizationId: { in: ['org-a', 'org-child'] } } },
  };
  const access = {
    hasAllEmployeeData: jest.fn(() => false),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
    getEmployeeWhere: jest.fn().mockResolvedValue(detailWhere),
  };
  return {
    service: new PersonnelLaborWorkersService(
      prisma as never,
      access as never,
      { enabled: demoEnabled } as never,
    ),
    findMany,
    count,
    reportingFindFirst,
    employeeFindMany,
    access,
    detailWhere,
  };
}

describe('PersonnelLaborWorkersService', () => {
  const pageQuery = { page: 2, pageSize: 20 };

  it('returns an empty page in Demo mode without querying Prisma', async () => {
    const { service, findMany } = createService([], true);

    await expect(service.findAll(user, pageQuery)).resolves.toEqual({
      data: [],
      meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('filters current active LABOR_WORKER periods through their exact primary assignment', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T15:30:00.000Z'));
    try {
      const row: PersonnelLaborWorkerRow = {
        employeeId: 'employee-1',
        employmentPeriodId: 'period-1',
        employee: {
          employeeNo: 'L-001',
          name: '虚构劳务人员',
          workEmail: 'fictional.labor@example.invalid',
        },
        employmentPeriod: { entryDate: new Date('2026-08-01T00:00:00.000Z') },
        organization: { name: '虚构子部门' },
        jobTitle: { name: '虚构职务' },
        position: { name: '真实职位' },
        workArrangement: 'LABOR_EMPLOYMENT',
      };
      const { service, findMany, reportingFindFirst, access } = createService([row]);
      reportingFindFirst.mockResolvedValue({ manager: { name: '虚构直线经理' } });

      const result = await service.findAll(user, {
        keyword: 'L-001',
        entryDateFrom: '2026-08-01',
        entryDateTo: '2026-08-31',
        page: 2,
        pageSize: 20,
      });

      const currentLaborPeriod = {
        employmentRelationship: EmploymentRelationship.LABOR_WORKER,
        employmentStatus: {
          in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR],
        },
        actualExitDate: null,
        entryDate: {
          lte: new Date('2026-08-31T00:00:00.000Z'),
          gte: new Date('2026-08-01'),
        },
        status: RecordStatus.ACTIVE,
        archivedAt: null,
      };
      expect(access.getAccessibleOrganizationIds).toHaveBeenCalledWith(user);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { isPrimary: true },
            { status: AssignmentStatus.ACTIVE },
            { archivedAt: null },
            { startDate: { lte: new Date('2026-08-31T00:00:00.000Z') } },
            { employmentPeriod: { is: currentLaborPeriod } },
            { organizationId: { in: ['org-a', 'org-child'] } },
            { employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } } },
            {
              employee: {
                is: {
                  OR: [
                    { employeeNo: { contains: 'L-001' } },
                    { name: { contains: 'L-001' } },
                  ],
                },
              },
            },
          ]),
        },
        select: {
          employeeId: true,
          employmentPeriodId: true,
          employee: { select: { employeeNo: true, name: true, workEmail: true } },
          employmentPeriod: { select: { entryDate: true } },
          organization: { select: { name: true } },
          jobTitle: { select: { name: true } },
          position: { select: { name: true } },
          workArrangement: true,
        },
        orderBy: [{ employmentPeriod: { entryDate: 'desc' } }, { id: 'asc' }],
        skip: 20,
        take: 20,
      }));
      expect(result).toEqual({
        data: [{
          name: '虚构劳务人员',
          workEmail: 'fictional.labor@example.invalid',
          employeeNo: 'L-001',
          entryDate: '2026-08-01',
          departmentName: '虚构子部门',
          jobTitleName: '虚构职务',
          positionName: '真实职位',
          workArrangement: 'LABOR_EMPLOYMENT',
          managerName: '虚构直线经理',
          employeeId: 'employee-1',
          canViewEmployeeDetail: true,
        }],
        meta: { page: 2, pageSize: 20, total: 1, totalPages: 1 },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses the expanded organization tree and never queries a non-primary assignment', async () => {
    const { service, findMany } = createService();

    await service.findAll(user, { page: 1, pageSize: 10 });

    const call = findMany.mock.calls[0]?.[0];
    expect(call.where.AND).toEqual(expect.arrayContaining([
      { organizationId: { in: ['org-a', 'org-child'] } },
      { isPrimary: true },
      { status: AssignmentStatus.ACTIVE },
      { archivedAt: null },
    ]));
    expect(call.where.AND).toEqual(expect.arrayContaining([
      {
        employmentPeriod: {
          is: expect.objectContaining({
            employmentRelationship: EmploymentRelationship.LABOR_WORKER,
            actualExitDate: null,
            status: RecordStatus.ACTIVE,
            archivedAt: null,
          }),
        },
      },
    ]));
    expect(call.select).toEqual(expect.objectContaining({
      organization: { select: { name: true } },
      jobTitle: { select: { name: true } },
      position: { select: { name: true } },
    }));
  });

  it('ties the displayed department, job title, and position to the selected period rather than another period', async () => {
    const { service, findMany } = createService();

    await service.findAll(user, { page: 1, pageSize: 10 });

    const call = findMany.mock.calls[0]?.[0];
    expect(call.where.AND).toEqual(expect.arrayContaining([
      { employmentPeriod: { is: expect.any(Object) } },
    ]));
    expect(call.select).toHaveProperty('employmentPeriod');
    expect(call.select).not.toHaveProperty('assignments');
  });

  it('selects only a current primary ADMINISTRATIVE manager with deterministic labor-worker ordering', async () => {
    const row: PersonnelLaborWorkerRow = {
      employeeId: 'employee-manager',
      employmentPeriodId: 'period-manager',
      employee: { employeeNo: 'L-002', name: '虚构劳务人员二', workEmail: null },
      employmentPeriod: { entryDate: new Date('2026-08-01T00:00:00.000Z') },
      organization: { name: '虚构部门' },
      jobTitle: null,
      position: null,
      workArrangement: 'LABOR_EMPLOYMENT',
    };
    const { service, reportingFindFirst } = createService([row]);
    reportingFindFirst.mockResolvedValue({ manager: { name: '主要经理' } });

    const result = await service.findAll(user, { page: 1, pageSize: 10 });

    expect(reportingFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        employeeId: 'employee-manager',
        relationshipType: ReportingRelationshipType.ADMINISTRATIVE,
        isPrimary: true,
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        startDate: { lte: expect.any(Date) },
        manager: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } },
      }),
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
      select: { manager: { select: { name: true } } },
    }));
    expect(result.data[0]?.managerName).toBe('主要经理');
  });

  it('calculates detail availability using the employee current scope, independently of the list row', async () => {
    const row: PersonnelLaborWorkerRow = {
      employeeId: 'employee-no-detail',
      employmentPeriodId: 'period-no-detail',
      employee: { employeeNo: 'L-003', name: '虚构无详情权限人员', workEmail: null },
      employmentPeriod: { entryDate: new Date('2026-08-01T00:00:00.000Z') },
      organization: { name: '范围内当前部门' },
      jobTitle: null,
      position: null,
      workArrangement: 'LABOR_EMPLOYMENT',
    };
    const { service, employeeFindMany, access, detailWhere } = createService([row]);
    employeeFindMany.mockResolvedValue([]);

    const result = await service.findAll(user, { page: 1, pageSize: 10 });

    expect(access.getEmployeeWhere).toHaveBeenCalledWith(
      user,
      ['org-a', 'org-child'],
      expect.any(Date),
    );
    expect(employeeFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: { in: ['employee-no-detail'] } },
          detailWhere,
        ],
      },
      select: { id: true },
    });
    expect(result.data[0]?.canViewEmployeeDetail).toBe(false);
  });
});
