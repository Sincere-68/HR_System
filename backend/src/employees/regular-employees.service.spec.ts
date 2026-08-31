import { EmploymentRelationship, EmploymentStatus } from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { EmployeesService } from './employees.service';

const scopedUser = {
  id: 'user-1',
  username: 'regular-viewer',
  displayName: '虚构正式人员查看者',
  role: 'DEPT_ADMIN' as const,
  roleName: '部门管理员',
  permissions: [PERMISSIONS.EMPLOYEE_READ],
  organizationIds: ['org-root'],
};

const regularRow = {
  id: 'employee-regular-1',
  name: '虚构正式员工',
  employeeNo: 'FAKE-REGULAR-001',
  gender: 'FEMALE',
  workEmail: 'regular.employee@example.invalid',
  bankName: 'ICBC',
  bankAccountNumber: '6222000000000000001',
  bankBranchName: '虚构支行',
  employmentPeriods: [{
    entryDate: new Date('2026-01-02T00:00:00.000Z'),
    assignments: [{
      organization: { name: '子级研发部' },
      position: { name: '软件工程师' },
      jobLevel: 'S2',
      workArrangement: 'CONTRACT_EMPLOYMENT',
    }],
    agreements: [{ employingCompany: { name: '虚构全日制公司' } }],
  }],
  reportingAsEmployee: [{ manager: { name: '虚构行政经理' } }],
};

function createService({ demo = false, rows = [regularRow] as object[] } = {}) {
  const prisma = {
    organization: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'org-root', parentId: null },
        { id: 'org-child', parentId: 'org-root' },
        { id: 'org-outside', parentId: null },
      ]),
    },
    employee: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(rows.length),
    },
    $transaction: jest.fn((queries: unknown[]) => Promise.all(queries as Promise<unknown>[])),
  };
  const access = new AccessControlService(prisma as never, { enabled: demo } as never);
  const service = new EmployeesService(prisma as never, access, { create: jest.fn() } as never, { enabled: demo } as never);
  return { service, prisma };
}

describe('EmployeesService.findRegularEmployees', () => {
  afterEach(() => jest.useRealTimers());

  it('uses an employee-root current internal REGULAR period with a current primary assignment', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T15:30:00.000Z'));
    const { service, prisma } = createService();

    const result = await service.findRegularEmployees(scopedUser, {
      keyword: 'FAKE', organizationId: 'org-root', page: 2, pageSize: 5,
    });

    expect(result.data[0]).toEqual(expect.objectContaining({
      employeeId: 'employee-regular-1',
      departmentName: '子级研发部',
      fullTimeCompany: '虚构全日制公司',
      resumeInfo: null,
      interviewEvaluation: null,
      canViewEmployeeDetail: true,
    }));
    expect(result.meta).toEqual({ page: 2, pageSize: 5, total: 1, totalPages: 1 });

    const args = prisma.employee.findMany.mock.calls[0][0];
    const period = args.where.AND[2].employmentPeriods.some;
    expect(period).toEqual(expect.objectContaining({
      employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
      employmentStatus: EmploymentStatus.REGULAR,
      status: 'ACTIVE',
      archivedAt: null,
      actualExitDate: null,
      entryDate: { lte: new Date('2026-08-31T00:00:00.000Z') },
    }));
    expect(period.assignments.some).toEqual(expect.objectContaining({
      isPrimary: true,
      status: 'ACTIVE',
      archivedAt: null,
      organizationId: { in: ['org-root', 'org-child'] },
      startDate: { lte: new Date('2026-08-31T00:00:00.000Z') },
      OR: [{ endDate: null }, { endDate: { gte: new Date('2026-08-31T00:00:00.000Z') } }],
    }));
    expect(args.where.AND).toEqual(expect.arrayContaining([
      { recordStatus: 'ACTIVE' },
      { archivedAt: null },
      { OR: [{ name: { contains: 'FAKE' } }, { employeeNo: { contains: 'FAKE' } }] },
    ]));
    expect(args.orderBy).toEqual([{ employeeNo: 'asc' }, { id: 'asc' }]);
    expect(args.skip).toBe(5);
    expect(args.take).toBe(5);
    expect(prisma.employee.count).toHaveBeenCalledWith({ where: args.where });
  });

  it('returns an empty page without database employee queries for an unauthorized organization', async () => {
    const { service, prisma } = createService();

    await expect(service.findRegularEmployees(scopedUser, {
      organizationId: 'org-outside', page: 3, pageSize: 20,
    })).resolves.toEqual({
      data: [], meta: { page: 3, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('uses the existing current-employee scope for detail availability', async () => {
    const { service, prisma } = createService();
    prisma.employee.findMany
      .mockResolvedValueOnce([regularRow])
      .mockResolvedValueOnce([]);

    const result = await service.findRegularEmployees(scopedUser, { page: 1, pageSize: 10 });

    expect(result.data[0]?.canViewEmployeeDetail).toBe(false);
    const detailArgs = prisma.employee.findMany.mock.calls[1][0];
    expect(detailArgs.where).toEqual(expect.objectContaining({
      id: { in: ['employee-regular-1'] },
      OR: expect.any(Array),
    }));
  });

  it('keeps detail availability in the full current employee scope, not the selected filter subtree', async () => {
    const { service, prisma } = createService();

    await service.findRegularEmployees(scopedUser, {
      organizationId: 'org-child', page: 1, pageSize: 10,
    });

    const detailArgs = prisma.employee.findMany.mock.calls[1][0];
    expect(detailArgs.where).toEqual(expect.objectContaining({
      id: { in: ['employee-regular-1'] },
      OR: expect.arrayContaining([
        expect.objectContaining({
          assignments: {
            some: expect.objectContaining({ organizationId: { in: ['org-root', 'org-child'] } }),
          },
        }),
      ]),
    }));
  });

  it('selects a stable current agreement company and only primary administrative manager', async () => {
    const { service, prisma } = createService();

    await service.findRegularEmployees(scopedUser, { page: 1, pageSize: 10 });

    const select = prisma.employee.findMany.mock.calls[0][0].select;
    const agreement = select.employmentPeriods.select.agreements;
    expect(agreement.where).toEqual(expect.objectContaining({
      status: 'ACTIVE',
      archivedAt: null,
      startDate: expect.any(Object),
    }));
    expect(agreement.orderBy).toEqual([
      { startDate: 'desc' },
      { renewalSequence: 'desc' },
      { signingDate: 'desc' },
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
    expect(agreement.take).toBe(1);
    expect(agreement.select).toEqual({ employingCompany: { select: { name: true } } });
    expect(select.reportingAsEmployee).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        relationshipType: 'ADMINISTRATIVE', isPrimary: true, status: 'ACTIVE', archivedAt: null,
      }),
      take: 1,
    }));
  });

  it('returns the requested empty pagination shape in demo mode without fabricating relation data', async () => {
    const { service, prisma } = createService({ demo: true });

    await expect(service.findRegularEmployees(scopedUser, { page: 4, pageSize: 25 })).resolves.toEqual({
      data: [], meta: { page: 4, pageSize: 25, total: 0, totalPages: 0 },
    });
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });
});
