import { AgreementStatus, AssignmentStatus, ProcessStatus, RecordStatus } from '@prisma/client';
import { PersonnelResignedService } from './personnel-resigned.service';

const user = {
  id: 'user-1',
  username: 'viewer',
  displayName: '虚构查看者',
  role: 'VIEWER' as const,
  roleName: '查看者',
  permissions: ['employee.read'] as never,
  organizationIds: ['org-a'],
};

const terminationRow = {
  id: 'termination-1',
  employeeId: 'employee-1',
  employmentPeriodId: 'period-1',
  plannedLastWorkingDate: new Date('2026-09-30T00:00:00.000Z'),
  actualLastWorkingDate: new Date('2026-09-28T00:00:00.000Z'),
  reason: '虚构离职原因',
  employee: {
    employeeNo: 'FAKE-001',
    name: '虚构员工',
    gender: 'FEMALE',
    mobile: '13900001001',
    identityDocuments: [{ documentNumber: 'PRIMARY-DOCUMENT', isPrimary: true }],
  },
  employmentPeriod: { entryDate: new Date('2020-01-01T00:00:00.000Z') },
};

function createService({
  demo = false,
  rows = [terminationRow] as object[],
  visibleRows = [{ id: 'termination-1' }] as object[],
} = {}) {
  const terminationFindMany = jest.fn().mockResolvedValue(rows);
  const terminationCount = jest.fn().mockResolvedValue(rows.length);
  const assignmentFindFirst = jest.fn().mockResolvedValue({
    organization: { name: '离职前部门' },
    position: { name: '离职前职位' },
  });
  const agreementFindFirst = jest.fn().mockResolvedValue({
    employingCompany: { name: '虚构全日制公司' },
  });
  const queryRaw = jest.fn().mockResolvedValue(visibleRows);
  const prisma = {
    terminationRecord: { findMany: terminationFindMany, count: terminationCount },
    employeeAssignment: { findFirst: assignmentFindFirst },
    employeeAgreement: { findFirst: agreementFindFirst },
    $queryRaw: queryRaw,
    $transaction: jest.fn((operations: readonly Promise<unknown>[]) => Promise.all(operations)),
  };
  const access = {
    hasAllEmployeeData: jest.fn(() => false),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
  };
  return {
    service: new PersonnelResignedService(prisma as never, access as never, { enabled: demo } as never),
    terminationFindMany,
    terminationCount,
    assignmentFindFirst,
    agreementFindFirst,
    queryRaw,
    access,
  };
}

describe('PersonnelResignedService', () => {
  it('returns an empty page in demo mode without querying database read-model tables', async () => {
    const { service, terminationFindMany, queryRaw, assignmentFindFirst, agreementFindFirst } = createService({ demo: true });

    await expect(service.findAll(user, { page: 2, pageSize: 20 })).resolves.toEqual({
      data: [],
      meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(terminationFindMany).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(assignmentFindFirst).not.toHaveBeenCalled();
    expect(agreementFindFirst).not.toHaveBeenCalled();
  });

  it('only reads unarchived completed termination records while preserving history for archived employee masters', async () => {
    const { service, terminationFindMany } = createService();

    await service.findAll(user, { page: 1, pageSize: 10 });

    const where = terminationFindMany.mock.calls[0]?.[0].where;
    expect(where).toEqual({
      AND: expect.arrayContaining([
        { status: ProcessStatus.COMPLETED },
        { archivedAt: null },
      ]),
    });
    expect(where.AND).not.toContainEqual({
      employee: { is: { archivedAt: null, recordStatus: RecordStatus.ACTIVE } },
    });
    expect(terminationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ plannedLastWorkingDate: 'desc' }, { id: 'asc' }],
    }));
  });

  it('authorizes historical rows only through same-period primary assignment at the resolved last-working date', async () => {
    const { service, queryRaw, assignmentFindFirst } = createService();

    await service.findAll(user, { page: 1, pageSize: 10 });

    const authorizationSql = queryRaw.mock.calls[0]?.[0] as {
      strings: readonly string[];
      values: readonly unknown[];
    };
    const authorizationText = authorizationSql.strings.join('?');
    expect(authorizationSql.values).toEqual(expect.arrayContaining([
      'org-a', 'org-child', AssignmentStatus.ACTIVE, AssignmentStatus.ENDED,
    ]));
    expect(authorizationText).toContain('assignment.employee_id = termination.employee_id');
    expect(authorizationText).toContain('assignment.employment_period_id = termination.employment_period_id');
    expect(authorizationText).toContain('assignment.is_primary = TRUE');
    expect(authorizationText).toContain('assignment.start_date <= COALESCE');
    expect(authorizationText).toContain('assignment.end_date >= COALESCE');

    expect(assignmentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        employeeId: 'employee-1',
        employmentPeriodId: 'period-1',
        organizationId: { in: ['org-a', 'org-child'] },
        isPrimary: true,
        status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
        startDate: { lte: terminationRow.actualLastWorkingDate },
        OR: [{ endDate: null }, { endDate: { gte: terminationRow.actualLastWorkingDate } }],
      }),
    }));
  });

  it('maps effective primary assignment, associated entry date, and completed-record fields without a detail action', async () => {
    const { service } = createService();

    const result = await service.findAll(user, { page: 1, pageSize: 10 });

    expect(result.data).toEqual([{
      id: 'termination-1',
      employeeNo: 'FAKE-001',
      name: '虚构员工',
      departmentName: '离职前部门',
      gender: 'FEMALE',
      entryDate: '2020-01-01',
      previousPositionName: '离职前职位',
      terminationReason: '虚构离职原因',
      movementType: null,
      lastWorkingDate: '2026-09-28',
      lastWorkingDateBasis: 'ACTUAL',
      fullTimeCompany: '虚构全日制公司',
      documentNumber: 'PRIMARY-DOCUMENT',
      mobile: '13900001001',
    }]);
    expect(result.data[0]).not.toHaveProperty('canViewEmployeeDetail');
    expect(result.meta).toEqual({ page: 1, pageSize: 10, total: 1, totalPages: 1 });
  });

  it('selects the same-period effective ACTIVE agreement in the required stable order', async () => {
    const { service, agreementFindFirst } = createService();

    await service.findAll(user, { page: 1, pageSize: 10 });

    expect(agreementFindFirst).toHaveBeenCalledWith({
      where: {
        employeeId: 'employee-1',
        employmentPeriodId: 'period-1',
        status: AgreementStatus.ACTIVE,
        archivedAt: null,
        startDate: { lte: terminationRow.actualLastWorkingDate },
        OR: [{ endDate: null }, { endDate: { gte: terminationRow.actualLastWorkingDate } }],
        AND: [{ OR: [{ terminationDate: null }, { terminationDate: { gt: terminationRow.actualLastWorkingDate } }] }],
      },
      orderBy: [
        { startDate: 'desc' },
        { renewalSequence: 'desc' },
        { signingDate: 'desc' },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
      select: { employingCompany: { select: { name: true } } },
    });
  });

  it('omits an undefined organization filter for all-data users', async () => {
    const { service, assignmentFindFirst, access } = createService();
    access.hasAllEmployeeData.mockReturnValue(true);

    await service.findAll({ ...user, permissions: ['employee.read', 'employee.data.all'] as never }, { page: 1, pageSize: 10 });

    const assignmentWhere = assignmentFindFirst.mock.calls[0]?.[0].where;
    expect(assignmentWhere).not.toHaveProperty('organizationId');
  });

  it('selects only active unarchived identity documents in primary-first stable order', async () => {
    const { service, terminationFindMany } = createService();

    await service.findAll(user, { page: 1, pageSize: 10 });

    const select = terminationFindMany.mock.calls[0]?.[0].select;
    expect(select.employee.select.identityDocuments).toEqual({
      where: { status: RecordStatus.ACTIVE, archivedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      select: { documentNumber: true, isPrimary: true },
    });
  });

  it('applies keyword, resolved-date range, and pagination before querying relation snapshots', async () => {
    const { service, terminationFindMany } = createService();

    await service.findAll(user, {
      keyword: 'FAKE',
      lastWorkingDateFrom: '2026-09-01',
      lastWorkingDateTo: '2026-09-30',
      page: 2,
      pageSize: 20,
    });

    expect(terminationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: expect.arrayContaining([
          {
            employee: {
              is: {
                OR: [
                  { employeeNo: { contains: 'FAKE' } },
                  { name: { contains: 'FAKE' } },
                ],
              },
            },
          },
          {
            OR: [
              { actualLastWorkingDate: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') } },
              {
                actualLastWorkingDate: null,
                plannedLastWorkingDate: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') },
              },
            ],
          },
        ]),
      },
      skip: 20,
      take: 20,
    }));
  });

  it('returns an empty page without raw SQL when scoped users have no authorized organizations', async () => {
    const { service, access, queryRaw, terminationFindMany } = createService();
    access.getAccessibleOrganizationIds.mockResolvedValue([]);

    await expect(service.findAll({ ...user, organizationIds: [] }, { page: 3, pageSize: 5 })).resolves.toEqual({
      data: [],
      meta: { page: 3, pageSize: 5, total: 0, totalPages: 0 },
    });
    expect(queryRaw).not.toHaveBeenCalled();
    expect(terminationFindMany).not.toHaveBeenCalled();
  });
});
