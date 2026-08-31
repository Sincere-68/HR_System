import { AgreementStatus, AssignmentStatus, EmploymentStatus, RecordStatus } from '@prisma/client';
import { ContractsService } from './contracts.service';

const viewer = {
  id: 'user-viewer',
  username: 'viewer',
  displayName: '虚构查看者',
  role: 'VIEWER' as const,
  roleName: '查看者',
  permissions: ['employee.read'] as never,
  organizationIds: ['org-root'],
};

const adminWithoutAll = {
  ...viewer,
  role: 'ADMIN' as const,
  username: 'admin',
};

const allDataUser = {
  ...viewer,
  role: 'ADMIN' as const,
  username: 'admin-all',
  permissions: ['employee.read', 'employee.data.all'] as never,
};

function createService(rows: unknown[] = [], demoEnabled = false) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const count = jest.fn().mockResolvedValue(rows.length);
  const prisma = {
    employeeAgreement: { findMany, count },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const access = {
    hasAllEmployeeData: jest.fn(() => false),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-root', 'org-child']),
    getOrganizationSubtreeIds: jest.fn().mockResolvedValue(['org-child']),
  };
  const service = new ContractsService(prisma as never, access as never, { enabled: demoEnabled } as never);
  return { service, prisma, findMany, count, access };
}

const query = { page: 2, pageSize: 20 };

describe('ContractsService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a legal empty page in demo mode without touching access or Prisma', async () => {
    const { service, prisma, access } = createService([], true);

    await expect(service.findAll(viewer, query)).resolves.toEqual({
      data: [],
      meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(access.hasAllEmployeeData).not.toHaveBeenCalled();
    expect(access.getAccessibleOrganizationIds).not.toHaveBeenCalled();
  });

  it('filters current agreements using UTC local-natural-day boundaries and excludes early termination', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T15:30:00.000Z'));
    const { service, findMany, access } = createService();

    await service.findAll(viewer, { keyword: ' F-001 ', organizationId: 'org-child', page: 3, pageSize: 10 });

    expect(access.getOrganizationSubtreeIds).toHaveBeenCalledWith(
      'org-child',
      ['org-root', 'org-child'],
    );
    const options = findMany.mock.calls[0][0];
    expect(options.where).toEqual({
      AND: expect.arrayContaining([
        { status: AgreementStatus.ACTIVE },
        { archivedAt: null },
        { startDate: { lte: new Date('2026-08-26T00:00:00.000Z') } },
        { OR: [{ endDate: null }, { endDate: { gte: new Date('2026-08-26T00:00:00.000Z') } }] },
        { OR: [{ terminationDate: null }, { terminationDate: { gt: new Date('2026-08-26T00:00:00.000Z') } }] },
        { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
        {
          employee: {
            is: {
              OR: [{ employeeNo: { contains: 'F-001' } }, { name: { contains: 'F-001' } }],
            },
          },
        },
        {
          employmentPeriod: {
            is: {
              status: RecordStatus.ACTIVE,
              archivedAt: null,
              employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
              actualExitDate: null,
              assignments: {
                some: {
                  status: AssignmentStatus.ACTIVE,
                  archivedAt: null,
                  startDate: { lte: new Date('2026-08-26T00:00:00.000Z') },
                  OR: [{ endDate: null }, { endDate: { gte: new Date('2026-08-26T00:00:00.000Z') } }],
                  organizationId: { in: ['org-child'] },
                },
              },
            },
          },
        },
      ]),
    });
    expect(options.skip).toBe(20);
    expect(options.take).toBe(10);
    expect(options.orderBy).toEqual([
      { startDate: 'desc' },
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
    expect(options.where.AND).not.toContainEqual({ terminationDate: { gte: expect.any(Date) } });
  });

  it('uses the selected organization subtree and keeps the same where for count', async () => {
    const { service, findMany, count, access } = createService();
    const selected = { keyword: '虚构', organizationId: 'org-child', page: 1, pageSize: 10 };

    await service.findAll(viewer, selected);

    expect(access.getOrganizationSubtreeIds).toHaveBeenCalledWith('org-child', ['org-root', 'org-child']);
    expect(count).toHaveBeenCalledWith({ where: findMany.mock.calls[0][0].where });
  });

  it('keeps ADMIN without employee.data.all in the restricted current-period scope', async () => {
    const { service, findMany, access } = createService();

    await service.findAll(adminWithoutAll, { page: 1, pageSize: 10 });

    expect(access.hasAllEmployeeData).toHaveBeenCalledWith(adminWithoutAll);
    expect(findMany.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([
      {
        employmentPeriod: {
          is: expect.objectContaining({
            status: RecordStatus.ACTIVE,
            employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
            actualExitDate: null,
          }),
        },
      },
    ]));
  });

  it('allows all-data users to include a current agreement without a period', async () => {
    const { service, findMany, access } = createService();
    access.hasAllEmployeeData.mockReturnValue(true);

    await service.findAll(allDataUser, { page: 1, pageSize: 10 });

    const conditions = findMany.mock.calls[0][0].where.AND;
    expect(conditions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ employmentPeriod: expect.any(Object) }),
    ]));
  });

  it('maps the explicit end date, derives term type, and keeps electronic fields null', async () => {
    const row = {
      id: 'agreement-1',
      agreementType: 'LABOR_CONTRACT',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2027-01-01T00:00:00.000Z'),
      employee: { employeeNo: 'F-001', name: '虚构员工' },
      employmentPeriod: {
        entryDate: new Date('2025-12-01T00:00:00.000Z'),
        assignments: [{ isPrimary: true, organization: { name: '虚构部门' } }],
      },
      employingCompany: { name: '虚构全日制公司' },
    };
    const { service } = createService([row]);
    const result = await service.findAll(allDataUser, { page: 1, pageSize: 10 });

    expect(result.data[0]).toEqual({
      id: 'agreement-1',
      employeeNo: 'F-001',
      employeeName: '虚构员工',
      departmentName: '虚构部门',
      entryDate: '2025-12-01',
      fullTimeCompany: '虚构全日制公司',
      agreementType: 'LABOR_CONTRACT',
      termType: 'FIXED',
      effectiveDate: '2026-01-01',
      endDate: '2027-01-01',
      latestElectronicSignatureStatus: null,
      latestElectronicAgreementAttachment: null,
      electronicSignatureRecords: null,
      contractRemark: null,
    });
  });

  it('maps an open-ended agreement and null period/display values', async () => {
    const row = {
      id: 'agreement-open',
      agreementType: 'OTHER',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: null,
      employee: { employeeNo: 'F-002', name: '虚构员工二' },
      employmentPeriod: null,
      employingCompany: null,
    };
    const { service } = createService([row]);
    const result = await service.findAll(allDataUser, { page: 1, pageSize: 10 });

    expect(result.data[0]).toEqual(expect.objectContaining({
      departmentName: null,
      entryDate: null,
      fullTimeCompany: null,
      termType: 'OPEN_ENDED',
      endDate: null,
      latestElectronicSignatureStatus: null,
      latestElectronicAgreementAttachment: null,
      electronicSignatureRecords: null,
      contractRemark: null,
    }));
  });

  it('keeps a contract visible through a non-primary authorized assignment but leaves department blank', async () => {
    const row = {
      id: 'agreement-non-primary',
      agreementType: 'LABOR_CONTRACT',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: null,
      employee: { employeeNo: 'F-003', name: '虚构非主要任职员工' },
      employmentPeriod: {
        entryDate: new Date('2025-12-01T00:00:00.000Z'),
        assignments: [],
      },
      employingCompany: null,
    };
    const { service, findMany } = createService([row]);
    const result = await service.findAll(viewer, { page: 1, pageSize: 10 });

    expect(result.data[0]).toEqual(expect.objectContaining({
      employeeNo: 'F-003',
      departmentName: null,
      entryDate: '2025-12-01',
    }));
    const where = findMany.mock.calls[0][0].where.AND;
    const periodCondition = where.find((condition: any) => condition.employmentPeriod);
    expect(periodCondition.employmentPeriod.is.assignments.some).not.toHaveProperty('isPrimary');
    const displayWhere = findMany.mock.calls[0][0].select.employmentPeriod.select.assignments.where;
    expect(displayWhere).toEqual(expect.objectContaining({ isPrimary: true }));
  });

  it('selects only the approved contract and display fields', async () => {
    const { service, findMany } = createService();
    await service.findAll(allDataUser, { page: 1, pageSize: 10 });

    const select = findMany.mock.calls[0][0].select;
    expect(select).toEqual({
      id: true,
      agreementType: true,
      startDate: true,
      endDate: true,
      employee: { select: { employeeNo: true, name: true } },
      employmentPeriod: {
        select: {
          entryDate: true,
          assignments: {
            where: expect.objectContaining({
              isPrimary: true,
              status: AssignmentStatus.ACTIVE,
              archivedAt: null,
              startDate: { lte: expect.any(Date) },
              OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
            }),
            orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
            take: 1,
            select: { organization: { select: { name: true } } },
          },
        },
      },
      employingCompany: { select: { name: true } },
    });
    expect(select).not.toHaveProperty('attachmentId');
    expect(select).not.toHaveProperty('status');
    expect(select).not.toHaveProperty('terminationDate');
    expect(select).not.toHaveProperty('terminationReason');
    expect(select).not.toHaveProperty('previousAgreement');
    expect(select).not.toHaveProperty('workLocation');
  });
});
