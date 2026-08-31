import { ConflictException } from '@nestjs/common';
import { AgreementStatus, AgreementType, EmploymentStatus, ProcessStatus, RecordStatus } from '@prisma/client';
import { EmployeeRosterService } from './employee-roster.service';

const user = {
  id: 'user-1',
  username: 'hr',
  displayName: '虚构人力资源',
  role: 'DEPT_ADMIN' as const,
  roleName: '部门管理员',
  permissions: ['employee.read'] as never,
  organizationIds: ['org-a'],
};

const employeeRow = {
  id: 'employee-1', name: '虚构员工', workEmail: 'employee@example.invalid', employeeNo: 'FAKE-001',
  gender: 'FEMALE', birthDate: new Date('1990-08-26T00:00:00.000Z'), mobile: '13900138000',
  personalEmail: 'personal@example.invalid', nativePlace: '虚构城市', householdAddress: '虚构地址',
  ethnicity: '虚构民族', maritalStatus: '未婚', politicalStatus: '群众',
  educationExperiences: [{ educationLevel: '本科', schoolName: '虚构大学', graduationDate: new Date('2012-06-30T00:00:00.000Z'), major: '虚构专业' }],
  identityDocuments: [{ documentNumber: 'FAKE-ID-001' }],
  familyMembers: [{ name: '虚构联系人', relationship: '母亲', mobile: '13800138000' }],
  reportingAsEmployee: [{ manager: { name: '虚构经理', workEmail: 'manager@example.invalid' } }],
  employmentPeriods: [{
    entryDate: new Date('2020-01-01T00:00:00.000Z'), personnelCategory: 'NON_TALENT_PROGRAM', employmentRelationship: 'INTERNAL_EMPLOYEE', employmentStatus: 'REGULAR',
    assignments: [{ startDate: new Date('2020-01-01T00:00:00.000Z'), endDate: null, organization: { id: 'org-a', name: '虚构部门' }, jobTitle: { name: '虚构职务' }, position: { name: '虚构职位' }, jobLevel: 'S1', workplace: { name: '虚构地点' } }],
    probationRecords: [{ startDate: new Date('2020-01-01T00:00:00.000Z'), plannedEndDate: new Date('2020-06-30T00:00:00.000Z'), probationMonths: 6, confirmedDate: new Date('2020-07-01T00:00:00.000Z') }],
    agreements: [{ agreementType: AgreementType.LABOR_CONTRACT, startDate: new Date('2020-01-01T00:00:00.000Z'), endDate: new Date('2030-01-01T00:00:00.000Z'), terminationDate: null, employingCompany: { name: '虚构公司' } }],
  }],
};

function createService({ demo = false, rows = [employeeRow] as object[] } = {}) {
  const prisma = {
    employee: { findMany: jest.fn().mockResolvedValue(rows), count: jest.fn().mockResolvedValue(rows.length) },
    organization: { findMany: jest.fn().mockResolvedValue([{ id: 'org-a', name: '虚构部门', parentId: null }]) },
    $transaction: jest.fn((queries: unknown[]) => Promise.all(queries as Promise<unknown>[])),
  };
  const access = {
    hasAllEmployeeData: jest.fn().mockReturnValue(false),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
    getOrganizationSubtreeIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
  };
  const service = new EmployeeRosterService(prisma as never, access as never, { enabled: demo } as never);
  return { service, prisma, access };
}

describe('EmployeeRosterService', () => {
  afterEach(() => jest.useRealTimers());

  it('rejects demo mode before touching Prisma or access control', async () => {
    const { service, prisma, access } = createService({ demo: true });
    await expect(service.findAll(user, { page: 2, pageSize: 20 })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
    expect(access.hasAllEmployeeData).not.toHaveBeenCalled();
  });

  it('returns one Employee-root row with mapped fields and null placeholders', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T15:30:00.000Z'));
    const { service } = createService();
    const result = await service.findAll(user, { page: 1, pageSize: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(expect.objectContaining({
      employeeNo: 'FAKE-001', workEmail: 'employee@example.invalid', departmentName: '虚构部门',
      jobTitleName: '虚构职务', positionName: '虚构职位', jobLevel: 'S1', managerName: '虚构经理',
      employmentRelationship: 'INTERNAL_EMPLOYEE', employmentStatus: 'REGULAR', hasProbation: true,
      probationMonths: 6, agreementType: AgreementType.LABOR_CONTRACT, fullTimeCompany: '虚构公司',
      contractTermType: 'FIXED', workStartDate: null, workYears: null, contractMonths: null, lastWorkingDate: null,
    }));
    expect(result.meta).toEqual({ page: 1, pageSize: 10, total: 1, totalPages: 1 });
  });

  it('uses current authorized assignments for employee scope and primary display', async () => {
    const { service, prisma } = createService();
    await service.findAll(user, { keyword: 'FAKE', organizationId: 'org-a', page: 2, pageSize: 5 });
    const args = prisma.employee.findMany.mock.calls[0][0];
    expect(args.where).toEqual(expect.objectContaining({
      AND: expect.arrayContaining([
        expect.objectContaining({ employmentPeriods: { some: expect.objectContaining({ assignments: { some: expect.objectContaining({ organizationId: { in: ['org-a', 'org-child'] } }) } }) } }),
        expect.objectContaining({ OR: [{ employeeNo: { contains: 'FAKE' } }, { name: { contains: 'FAKE' } }] }),
      ]),
    }));
    expect(args.orderBy).toEqual([{ employeeNo: 'asc' }, { id: 'asc' }]);
    expect(args.skip).toBe(5);
    expect(args.take).toBe(5);
    expect(prisma.employee.count).toHaveBeenCalledWith({ where: args.where });
  });

  it('does not scope an all-data user and still uses employee pagination', async () => {
    const { service, prisma, access } = createService();
    access.hasAllEmployeeData.mockReturnValue(true);
    await service.findAll({ ...user, permissions: ['employee.read', 'employee.data.all'] as never }, { page: 1, pageSize: 10 });
    const args = prisma.employee.findMany.mock.calls[0][0];
    expect(args.where.AND[2]).toEqual(expect.objectContaining({ employmentPeriods: { some: expect.not.objectContaining({ assignments: expect.anything() }) } }));
    expect(args.orderBy).toEqual([{ employeeNo: 'asc' }, { id: 'asc' }]);
  });

  it('filters current period and assignment with inclusive natural-day boundaries', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T15:30:00.000Z'));
    const { service, prisma } = createService();
    await service.findAll(user, { page: 1, pageSize: 10 });
    const where = prisma.employee.findMany.mock.calls[0][0].where;
    const period = where.AND[2].employmentPeriods.some;
    expect(period.entryDate).toEqual({ lte: new Date('2026-08-26T00:00:00.000Z') });
    expect(period.assignments.some.startDate).toEqual({ lte: new Date('2026-08-26T00:00:00.000Z') });
    expect(period.assignments.some.OR).toEqual([{ endDate: null }, { endDate: { gte: new Date('2026-08-26T00:00:00.000Z') } }]);
  });

  it('excludes non-full-time agreement in the nested current-contract query', async () => {
    const { service, prisma } = createService();
    await service.findAll(user, { page: 1, pageSize: 10 });
    const select = prisma.employee.findMany.mock.calls[0][0].select;
    const agreementWhere = select.employmentPeriods.select.agreements.where;
    expect(agreementWhere.AND).toEqual(expect.arrayContaining([
      { agreementType: { not: AgreementType.NON_FULL_TIME_EMPLOYMENT_CONTRACT } },
    ]));
    expect(select.employmentPeriods.select.agreements.take).toBe(1);
  });

  it('returns a stable empty page when the requested organization is not visible', async () => {
    const { service, prisma, access } = createService();
    access.getOrganizationSubtreeIds.mockResolvedValue([]);
    await expect(service.findAll(user, { organizationId: 'outside', page: 3, pageSize: 20 }))
      .resolves.toEqual({ data: [], meta: { page: 3, pageSize: 20, total: 0, totalPages: 0 } });
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('keeps employee status fields typed and actual termination separate from contract end date', async () => {
    const { service } = createService({ rows: [{ ...employeeRow, employmentPeriods: [{ ...employeeRow.employmentPeriods[0], agreements: [{ ...employeeRow.employmentPeriods[0].agreements[0], endDate: null, terminationDate: new Date('2027-01-01T00:00:00.000Z') }] }] }] });
    const result = await service.findAll({ ...user, permissions: ['employee.read', 'employee.data.all'] as never }, { page: 1, pageSize: 10 });
    expect(result.data[0]).toEqual(expect.objectContaining({ contractTermType: 'OPEN_ENDED', contractEndDate: null, actualTerminationDate: '2027-01-01' }));
  });
});
