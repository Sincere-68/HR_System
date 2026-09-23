import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AssignmentStatus, EmploymentRelationship, EmploymentStatus, ProcessStatus, WorkArrangement } from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { EmploymentDetailsController } from './employment-details.controller';
import { EmploymentDetailsService } from './employment-details.service';

const user = {
  id: 'user-1',
  username: 'hr-viewer',
  displayName: '虚构查看者',
  role: 'DEPT_ADMIN' as const,
  roleName: '部门管理员',
  permissions: [PERMISSIONS.EMPLOYEE_READ] as never,
  organizationIds: ['org-a'],
};

function createPrisma() {
  return {
    employeeAssignment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    employee: { findFirst: jest.fn() },
    probationRecord: { findUnique: jest.fn() },
    approvalRequest: { findFirst: jest.fn() },
    employeeMovement: { findUnique: jest.fn() },
    trialPostRecord: { findUnique: jest.fn() },
    employmentPeriod: { findUnique: jest.fn() },
    reportingRelationship: { findFirst: jest.fn() },
    terminationRecord: { findUnique: jest.fn() },
    retirementRecord: { findUnique: jest.fn() },
  };
}

function createAccess(overrides: Record<string, unknown> = {}) {
  return {
    hasPermission: jest.fn(() => true),
    hasAllEmployeeData: jest.fn(() => true),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(null),
    getEmployeeWhere: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function createService(options: {
  demoEnabled?: boolean;
  prisma?: ReturnType<typeof createPrisma>;
  access?: ReturnType<typeof createAccess>;
} = {}) {
  const prisma = options.prisma ?? createPrisma();
  const access = options.access ?? createAccess();
  const service = new EmploymentDetailsService(
    prisma as never,
    access as never,
    { enabled: options.demoEnabled ?? false } as never,
  );
  return { service, prisma, access };
}

describe('EmploymentDetailsController', () => {
  const controller = new EmploymentDetailsController({} as never);

  const routes = [
    ['getEmploymentRecord', 'records/:id'],
    ['getProbation', 'probation/:id'],
    ['getMovement', 'movements/:id'],
    ['getTrialPost', 'trial-posts/:id'],
    ['getIntern', 'interns/:id'],
    ['getLaborWorker', 'labor-workers/:id'],
    ['getTermination', 'terminations/:id'],
    ['getRetirement', 'retirements/:id'],
    ['getPartTime', 'part-time/:id'],
  ] as const;

  it.each(routes)('registers GET employment/%s at %s', (method, path) => {
    expect(Reflect.getMetadata(PATH_METADATA, EmploymentDetailsController)).toBe('employment');
    expect(Reflect.getMetadata(PATH_METADATA, controller[method])).toBe(path);
    expect(Reflect.getMetadata(METHOD_METADATA, controller[method])).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller[method])).toEqual([PERMISSIONS.EMPLOYEE_READ]);
  });
});

describe('EmploymentDetailsService', () => {
  it('returns a safe 404 in demo mode without touching Prisma', async () => {
    const { service, prisma } = createService({ demoEnabled: true });

    await expect(service.getEmploymentRecordDetail(user, 'assignment-1')).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.employeeAssignment.findUnique).not.toHaveBeenCalled();
  });

  it('uses EmployeeAssignment.id and preserves historical assignment fields', async () => {
    const { service, prisma } = createService();
    prisma.employeeAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      employeeId: 'employee-1',
      employmentPeriodId: 'period-1',
      organizationId: 'org-a',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      status: AssignmentStatus.ENDED,
      isPrimary: true,
      jobLevel: 'S2',
      assignmentType: 'PRIMARY',
      workArrangement: WorkArrangement.LABOR_EMPLOYMENT,
      employee: { employeeNo: 'E-001', name: '虚构员工', archivedAt: null, recordStatus: 'ACTIVE', employmentRecords: [], convertedCandidates: [] },
      employmentPeriod: {
        id: 'period-1', sequenceNo: 1, entryDate: new Date('2026-01-01T00:00:00.000Z'),
        actualExitDate: new Date('2026-06-30T00:00:00.000Z'),
        employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
        employmentRecords: [{ status: EmploymentStatus.REGULAR, effectiveAt: new Date('2026-01-01T00:00:00.000Z'), endedAt: null }],
      },
      organization: { id: 'org-a', code: 'A', name: '历史部门' },
      position: { id: 'position-1', name: '历史岗位' },
      jobTitle: null,
    });
    prisma.employeeAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });

    const result = await service.getEmploymentRecordDetail(user, 'assignment-1');

    expect(prisma.employeeAssignment.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'assignment-1' },
    }));
    expect(result).toEqual(expect.objectContaining({
      id: 'assignment-1',
      employeeId: 'employee-1',
      employeeNo: 'E-001',
      organization: { id: 'org-a', code: 'A', name: '历史部门' },
      position: { id: 'position-1', name: '历史岗位' },
      assignmentStatus: AssignmentStatus.ENDED,
      personnelStatus: EmploymentStatus.REGULAR,
      canViewEmployeeDetail: true,
    }));
  });

  it('returns 403 before querying when employee.read is missing', async () => {
    const prisma = createPrisma();
    const access = createAccess({ hasPermission: jest.fn(() => false) });
    const { service } = createService({ prisma, access });

    await expect(service.getRetirementDetail({ ...user, permissions: [] as never }, 'retirement-1'))
      .rejects.toMatchObject({ status: 403 });
    expect(prisma.retirementRecord.findUnique).not.toHaveBeenCalled();
  });

  it('does not treat employeeId as an intern period id and validates the relationship', async () => {
    const { service, prisma } = createService();
    prisma.employmentPeriod.findUnique.mockResolvedValue(null);

    await expect(service.getInternDetail(user, 'employee-1')).rejects.toMatchObject({ status: 404 });
    expect(prisma.employmentPeriod.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'employee-1' },
    }));
  });

  it('returns fixed nulls for unsupported part-time fields and requires PART_TIME', async () => {
    const { service, prisma } = createService();
    prisma.employeeAssignment.findUnique.mockResolvedValue({
      id: 'assignment-2', employeeId: 'employee-2', organizationId: 'org-a',
      workArrangement: WorkArrangement.PART_TIME, assignmentType: 'ADDITIONAL', isPrimary: false,
      startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: null, status: AssignmentStatus.ACTIVE,
      employee: { employeeNo: 'E-002', name: null, archivedAt: null, recordStatus: 'ACTIVE' },
      organization: { id: 'org-a', name: '部门' },
      position: null, jobTitle: null,
    });

    await expect(service.getPartTimeDetail(user, 'assignment-2')).resolves.toEqual(expect.objectContaining({
      id: 'assignment-2',
      employeeName: '--',
      partTimeType: null,
      institutionName: null,
      managerName: null,
      approvalStatus: null,
    }));
  });

  it('hides a historical probation record outside the caller organization scope', async () => {
    const access = createAccess({
      hasAllEmployeeData: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a']),
    });
    const { service, prisma } = createService({ access });
    prisma.probationRecord.findUnique.mockResolvedValue({
      id: 'probation-1', employeeId: 'employee-1', employmentPeriodId: 'period-1',
      startDate: new Date('2026-01-01T00:00:00.000Z'), plannedEndDate: new Date('2026-03-31T00:00:00.000Z'),
      probationMonths: 3, actualEndDate: null, evaluationType: null, result: null, evaluation: null,
      confirmedDate: null, extensionCount: 0, status: ProcessStatus.DRAFT, archivedAt: null,
      employee: { employeeNo: 'E-001', name: '员工', archivedAt: null, recordStatus: 'ACTIVE' },
      employmentPeriod: { id: 'period-1', sequenceNo: 1, employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE, employmentStatus: EmploymentStatus.PROBATION, entryDate: new Date('2026-01-01T00:00:00.000Z'), actualExitDate: null },
    });
    prisma.employeeAssignment.findFirst.mockResolvedValue(null);

    await expect(service.getProbationDetail(user, 'probation-1')).rejects.toMatchObject({ status: 404 });
  });

  it.each([EmploymentRelationship.INTERN, EmploymentRelationship.LABOR_WORKER])(
    'authorizes active %s periods by today\'s assignment and exited periods by exit-date assignment',
    async (relationship) => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-18T12:00:00.000Z'));
      try {
        const assignments = [
          {
            id: 'assignment-a', organizationId: 'org-a', positionId: 'position-a', jobTitleId: null,
            jobLevel: null, workplaceName: null, workArrangement: WorkArrangement.LABOR_EMPLOYMENT,
            assignmentType: 'PRIMARY', isPrimary: true,
            startDate: new Date('2026-01-01T00:00:00.000Z'), endDate: new Date('2026-06-30T00:00:00.000Z'),
            status: AssignmentStatus.ENDED, archivedAt: null,
            organization: { id: 'org-a', name: 'A 部门' }, position: { id: 'position-a', name: 'A 岗位' }, jobTitle: null,
          },
          {
            id: 'assignment-b', organizationId: 'org-b', positionId: 'position-b', jobTitleId: null,
            jobLevel: null, workplaceName: null, workArrangement: WorkArrangement.LABOR_EMPLOYMENT,
            assignmentType: 'PRIMARY', isPrimary: true,
            startDate: new Date('2026-07-01T00:00:00.000Z'), endDate: null,
            status: AssignmentStatus.ACTIVE, archivedAt: null,
            organization: { id: 'org-b', name: 'B 部门' }, position: { id: 'position-b', name: 'B 岗位' }, jobTitle: null,
          },
        ];
        const employee = { employeeNo: 'E-100', name: '周期员工', workEmail: 'period@example.test', archivedAt: null, recordStatus: 'ACTIVE' };
        const makePeriod = (actualExitDate: Date | null) => ({
          id: 'period-1', employeeId: 'employee-1', sequenceNo: 1, employmentRelationship: relationship,
          entryDate: new Date('2026-01-01T00:00:00.000Z'), plannedExitDate: null, actualExitDate,
          employmentStatus: EmploymentStatus.REGULAR, isRehire: false, previousPeriodId: null, status: 'ACTIVE', archivedAt: null,
          employee, assignments, employmentRecords: [],
        });
        const createPeriodService = (accessibleOrganizations: string[], actualExitDate: Date | null) => {
          const access = createAccess({
            hasAllEmployeeData: jest.fn(() => false),
            getAccessibleOrganizationIds: jest.fn().mockResolvedValue(accessibleOrganizations),
          });
          const { service, prisma } = createService({ access });
          prisma.employmentPeriod.findUnique.mockResolvedValue(makePeriod(actualExitDate));
          return service;
        };

        const getDetail = (service: EmploymentDetailsService) => relationship === EmploymentRelationship.INTERN
          ? service.getInternDetail(user, 'period-1')
          : service.getLaborWorkerDetail(user, 'period-1');
        await expect(getDetail(createPeriodService(['org-a'], null)))
          .rejects.toMatchObject({ status: 404 });
        await expect(getDetail(createPeriodService(['org-b'], null)))
          .resolves.toEqual(expect.objectContaining({ id: 'period-1', assignment: expect.objectContaining({ organizationId: 'org-b' }) }));

        const exitedA = createPeriodService(['org-a'], new Date('2026-06-30T00:00:00.000Z'));
        await expect(getDetail(exitedA))
          .resolves.toEqual(expect.objectContaining({ assignment: expect.objectContaining({ organizationId: 'org-a' }) }));
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('keeps archived historical assignments readable for records, termination, and retirement details', async () => {
    const access = createAccess({
      hasAllEmployeeData: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a']),
    });
    const { service, prisma } = createService({ access });
    const archivedAssignment = {
      id: 'assignment-archived', organizationId: 'org-a', positionId: 'position-a', jobTitleId: null,
      jobLevel: 'S2', workplaceName: null, workArrangement: WorkArrangement.LABOR_EMPLOYMENT,
      assignmentType: 'PRIMARY', isPrimary: true,
      startDate: new Date('2026-01-01T00:00:00.000Z'), endDate: new Date('2026-06-30T00:00:00.000Z'),
      status: AssignmentStatus.ENDED, archivedAt: new Date('2026-07-01T00:00:00.000Z'),
      organization: { id: 'org-a', name: '历史部门' }, position: { id: 'position-a', name: '历史岗位' }, jobTitle: null,
    };
    const employee = { employeeNo: 'E-200', name: '历史员工', archivedAt: null, recordStatus: 'ACTIVE' };
    prisma.employeeAssignment.findUnique.mockResolvedValue({
      ...archivedAssignment, employeeId: 'employee-2', employmentPeriodId: 'period-2',
      employee: { ...employee, convertedCandidates: [] },
      employmentPeriod: {
        id: 'period-2', sequenceNo: 1, entryDate: new Date('2026-01-01T00:00:00.000Z'),
        actualExitDate: new Date('2026-06-30T00:00:00.000Z'), employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
        employmentRecords: [],
      },
    });
    prisma.employeeAssignment.findFirst.mockResolvedValue(archivedAssignment);
    await expect(service.getEmploymentRecordDetail(user, 'assignment-archived'))
      .resolves.toEqual(expect.objectContaining({ id: 'assignment-archived', organization: { id: 'org-a', name: '历史部门' } }));

    prisma.terminationRecord.findUnique.mockResolvedValue({
      id: 'termination-1', employeeId: 'employee-2', employmentPeriodId: 'period-2',
      applicationDate: new Date('2026-06-01T00:00:00.000Z'), plannedLastWorkingDate: new Date('2026-06-30T00:00:00.000Z'),
      actualLastWorkingDate: null, terminationType: null, reason: null, rehireEligible: null, status: 'COMPLETED',
      updatedAt: new Date('2026-06-30T00:00:00.000Z'), archivedAt: null, employee,
      approvalRequest: null, handoverCase: null,
    });
    prisma.employeeAssignment.findFirst.mockResolvedValue(archivedAssignment);
    await expect(service.getTerminationDetail(user, 'termination-1'))
      .resolves.toEqual(expect.objectContaining({ id: 'termination-1', historicalAssignment: expect.objectContaining({ organizationId: 'org-a' }) }));

    prisma.retirementRecord.findUnique.mockResolvedValue({
      id: 'retirement-1', employeeId: 'employee-2', employmentPeriodId: 'period-2',
      plannedRetirementDate: new Date('2026-06-30T00:00:00.000Z'), actualRetirementDate: null,
      retirementType: null, pensionHandlingStatus: null, remark: null, status: 'COMPLETED', archivedAt: null, employee,
    });
    prisma.employeeAssignment.findFirst.mockResolvedValue(archivedAssignment);
    await expect(service.getRetirementDetail(user, 'retirement-1'))
      .resolves.toEqual(expect.objectContaining({ id: 'retirement-1', historicalAssignment: expect.objectContaining({ organizationId: 'org-a' }) }));
  });

  it('computes latest primary record within the caller authorized historical organization set', async () => {
    const access = createAccess({
      hasAllEmployeeData: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a']),
    });
    const { service, prisma } = createService({ access });
    const row = {
      id: 'assignment-a', employeeId: 'employee-3', employmentPeriodId: 'period-3', organizationId: 'org-a',
      jobLevel: null, assignmentType: 'PRIMARY', workArrangement: WorkArrangement.LABOR_EMPLOYMENT,
      startDate: new Date('2026-01-01T00:00:00.000Z'), endDate: new Date('2026-06-30T00:00:00.000Z'),
      status: AssignmentStatus.ENDED, isPrimary: true, archivedAt: null,
      employee: { employeeNo: 'E-300', name: '范围员工', archivedAt: null, recordStatus: 'ACTIVE', convertedCandidates: [] },
      employmentPeriod: {
        id: 'period-3', sequenceNo: 1, entryDate: new Date('2026-01-01T00:00:00.000Z'), actualExitDate: new Date('2026-06-30T00:00:00.000Z'),
        employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE, employmentRecords: [],
      },
      organization: { id: 'org-a', code: 'A', name: 'A 部门' }, position: null, jobTitle: null,
    };
    const authorizedLatest = { id: 'assignment-a' };
    const crossScopeLatest = { id: 'assignment-b' };
    prisma.employeeAssignment.findUnique.mockResolvedValue(row);
    prisma.employeeAssignment.findFirst.mockImplementation((args: any) => (
      args.where.organizationId?.in?.includes('org-a')
        ? Promise.resolve(authorizedLatest)
        : Promise.resolve(crossScopeLatest)
    ));

    await expect(service.getEmploymentRecordDetail(user, 'assignment-a'))
      .resolves.toEqual(expect.objectContaining({ isLatestPrimaryRecord: true }));
    expect(prisma.employeeAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: { in: ['org-a'] } }),
    }));
  });
});
