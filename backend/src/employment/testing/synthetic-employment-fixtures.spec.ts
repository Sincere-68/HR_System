import { createSyntheticEmploymentFixtures } from './synthetic-employment-fixtures';

describe('synthetic employment fixtures', () => {
  it('builds a fictional company catalogue with stable mock identifiers', () => {
    const fixtures = createSyntheticEmploymentFixtures();

    expect(fixtures.company).toEqual({
      id: 'company-mock-yunling',
      name: '云岭数科（模拟企业）',
    });
    expect(fixtures.organizations.map(({ name }) => name)).toEqual(expect.arrayContaining([
      '华东研发中心',
      '产品平台部',
      '客户交付部',
    ]));
    expect(fixtures.positions.map(({ name }) => name)).toEqual(expect.arrayContaining([
      '后端工程师',
      '产品经理',
      'HRBP',
    ]));
    expect(fixtures.employees.every(({ employeeNo }) => /^MOCK-HR-\d{3}$/.test(employeeNo))).toBe(true);
    expect(fixtures.employees.every(({ workEmail, mobile }) => workEmail === null && mobile === null)).toBe(true);
  });

  it('keeps cross-department history and rehire periods under one employee number', () => {
    const fixtures = createSyntheticEmploymentFixtures();
    const employee = fixtures.employees.find(({ employeeNo }) => employeeNo === 'MOCK-HR-001');

    expect(employee).toBeDefined();
    const periods = fixtures.employmentPeriods.filter(({ employeeId }) => employeeId === employee?.id);
    const assignments = fixtures.assignments.filter(({ employeeId }) => employeeId === employee?.id);

    expect(periods).toHaveLength(2);
    expect(periods.map(({ sequenceNo }) => sequenceNo)).toEqual([1, 2]);
    expect(periods[1]).toEqual(expect.objectContaining({
      previousPeriodId: periods[0]?.id,
      actualExitDate: null,
    }));
    expect(new Set(assignments.map(({ organizationId }) => organizationId))).toEqual(new Set([
      'org-product-platform',
      'org-customer-delivery',
    ]));
    expect(assignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'ENDED', endDate: '2024-06-30' }),
      expect.objectContaining({ status: 'ACTIVE', endDate: null }),
    ]));
    expect(new Set(periods.map(({ employeeId }) => employeeId))).toEqual(new Set([employee?.id]));
    expect(new Set(fixtures.employees
      .filter(({ id }) => periods.some(({ employeeId }) => employeeId === id))
      .map(({ employeeNo }) => employeeNo))).toEqual(new Set(['MOCK-HR-001']));
  });

  it('separates historical row visibility from current employee detail access', () => {
    const fixtures = createSyntheticEmploymentFixtures();

    expect(fixtures.authorization.current).toEqual(expect.objectContaining({
      visibleAssignmentIds: ['assignment-001-current'],
      canViewEmployeeDetail: true,
    }));
    expect(fixtures.authorization.history).toEqual(expect.objectContaining({
      visibleAssignmentIds: ['assignment-001-history'],
      canViewEmployeeDetail: false,
    }));
    expect(fixtures.authorization.current.visibleAssignmentIds)
      .not.toContain('assignment-001-history');
    expect(fixtures.authorization.history.visibleAssignmentIds)
      .not.toContain('assignment-001-current');
  });

  it('represents a worker without a current manager as a root without a synthetic edge', () => {
    const fixtures = createSyntheticEmploymentFixtures();
    const managerlessEmployeeId = fixtures.managerlessEmployeeId;

    expect(fixtures.reportingRelationships.filter(({ employeeId }) => employeeId === managerlessEmployeeId))
      .toHaveLength(0);
    expect(fixtures.employees.find(({ id }) => id === managerlessEmployeeId)?.managerEmployeeId).toBeNull();
  });

  it('keeps an approved probation request pending until its effective date', () => {
    const fixtures = createSyntheticEmploymentFixtures();
    const probation = fixtures.probationPendingEffect;

    expect(probation.approvalStatus).toBe('APPROVED');
    expect(probation.lifecycleStatus).toBe('PENDING_EFFECTIVE');
    expect(probation.effectiveAt).toBeNull();
    expect(probation.currentEmploymentStatus).toBe('PROBATION');
    expect(probation.targetEmploymentStatus).toBe('REGULAR');
  });

  it('uses null for intern, labor, and part-time fields without a confirmed source', () => {
    const fixtures = createSyntheticEmploymentFixtures();

    expect(fixtures.unsourcedFields).toEqual({
      intern: {
        internshipOrganizationName: null,
        approvalStatus: null,
        managerName: null,
        bankName: null,
        bankAccountNumber: null,
        bankBranchName: null,
      },
      labor: {
        conversionEventId: null,
        conversionStatus: null,
        managerName: null,
      },
      partTime: {
        partTimeType: null,
        institutionName: null,
        managerName: null,
        approvalStatus: null,
      },
    });
  });

  it('returns fresh plain data without a Prisma client or sensitive personal values', () => {
    const first = createSyntheticEmploymentFixtures();
    const second = createSyntheticEmploymentFixtures();

    expect(first).not.toBe(second);
    expect(first.employees).not.toBe(second.employees);
    expect(first).not.toHaveProperty('prisma');
    expect(first).not.toHaveProperty('client');
    expect(JSON.stringify(first)).not.toMatch(/\b\d{17}[\dXx]\b/);
    expect(JSON.stringify(first)).not.toMatch(/\b1[3-9]\d{9}\b/);
    expect(JSON.stringify(first)).not.toMatch(/@(?:qq|163|gmail)\.(?:com|cn)/i);
  });
});
