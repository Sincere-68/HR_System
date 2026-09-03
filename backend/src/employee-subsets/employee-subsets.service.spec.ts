import { PERMISSIONS } from '@hr-demo/shared';
import { AssignmentStatus, EmploymentStatus, RecordStatus } from '@prisma/client';
import { EmployeeSubsetsService } from './employee-subsets.service';

const user = {
  id: 'user-1',
  username: 'viewer',
  displayName: '虚构查看者',
  role: 'VIEWER' as const,
  roleName: '查看者',
  permissions: [PERMISSIONS.EMPLOYEE_READ],
  organizationIds: ['org-a'],
};
const query = { page: 3, pageSize: 25 } as never;
const emptyPage = {
  data: [],
  meta: { page: 3, pageSize: 25, total: 0, totalPages: 0 },
};
const activeEmploymentPeriodFilter = {
  employmentPeriod: {
    is: {
      status: RecordStatus.ACTIVE,
      archivedAt: null,
      employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
      actualExitDate: null,
    },
  },
};
const methods = [
  'findEducation',
  'findWorkHistory',
  'findFamily',
  'findAppraisals',
  'findTraining',
  'findAwards',
  'findCertificates',
  'findProjects',
  'findSkills',
  'findLanguages',
] as const;

function inaccessibleDependency(name: string) {
  return new Proxy({}, {
    get() {
      throw new Error(`${name} should not be accessed`);
    },
  });
}

function createFactService(
  fact: 'education' | 'work' | 'family' | 'appraisal' | 'training' | 'award' | 'certificate' | 'project' | 'skill' | 'language',
  rows: unknown[] = [],
  options: { all?: boolean; accessible?: string[] } = {},
) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const count = jest.fn().mockResolvedValue(rows.length);
  const employeeFindMany = jest.fn().mockResolvedValue([]);
  const getAccessibleOrganizationIds = jest.fn().mockResolvedValue(options.accessible ?? ['org-a', 'org-child']);
  const getOrganizationSubtreeIds = jest.fn().mockResolvedValue(['org-child']);
  const getEmployeeWhere = jest.fn().mockResolvedValue({
    assignments: { some: { status: RecordStatus.ACTIVE } },
  });
  const access = {
    hasAllEmployeeData: jest.fn(() => options.all ?? false),
    getAccessibleOrganizationIds,
    getOrganizationSubtreeIds,
    getEmployeeWhere,
  };
  const prisma = {
    employeeEducationExperience: fact === 'education' ? { findMany, count } : inaccessibleDependency('Education delegate'),
    employeeWorkExperience: fact === 'work' ? { findMany, count } : inaccessibleDependency('Work delegate'),
    employeeFamilyMember: fact === 'family' ? { findMany, count } : inaccessibleDependency('Family delegate'),
    employeeAppraisal: fact === 'appraisal' ? { findMany, count } : inaccessibleDependency('Appraisal delegate'),
    employeeTrainingRecord: fact === 'training' ? { findMany, count } : inaccessibleDependency('Training delegate'),
    employeeAward: fact === 'award' ? { findMany, count } : inaccessibleDependency('Award delegate'),
    employeeCertificate: fact === 'certificate' ? { findMany, count } : inaccessibleDependency('Certificate delegate'),
    employeeProjectExperience: fact === 'project' ? { findMany, count } : inaccessibleDependency('Project delegate'),
    employeeSkill: fact === 'skill' ? { findMany, count } : inaccessibleDependency('Skill delegate'),
    employeeLanguageAbility: fact === 'language' ? { findMany, count } : inaccessibleDependency('Language delegate'),
    employee: { findMany: employeeFindMany },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  return {
    service: new EmployeeSubsetsService(prisma as never, access as never, { enabled: false } as never),
    prisma,
    findMany,
    count,
    employeeFindMany,
    access,
  };
}

const employee = {
  id: 'employee-1',
  name: '虚构员工甲',
  employeeNo: 'DEMO-1001',
  workEmail: 'fictional.employee@example.invalid',
};

const educationRow = {
  id: 'education-1',
  employeeId: employee.id,
  startDate: new Date('2018-09-01T00:00:00.000Z'),
  endDate: new Date('2022-06-30T00:00:00.000Z'),
  schoolName: '虚构大学',
  major: '虚构专业',
  educationLevel: '本科',
  degree: '学士',
  isHighestEducation: true,
  employee: {
    ...employee,
    assignments: [{ organization: { name: '虚构研发部' } }],
  },
};

const workRow = {
  id: 'work-1',
  employeeId: employee.id,
  companyName: '虚构科技公司',
  positionName: '历史事实职位不应展示',
  startDate: new Date('2020-01-01T00:00:00.000Z'),
  endDate: null,
  referenceName: '虚构证明人',
  employee: {
    ...employee,
    assignments: [{ organization: { name: '虚构运营部' }, jobTitle: { name: '当前虚构职务' } }],
  },
};

const familyRow = {
  id: 'family-1',
  employeeId: employee.id,
  name: '虚构家属甲',
  relationship: '母亲',
  gender: 'FEMALE',
  mobile: '13912345678',
  employee: {
    ...employee,
    assignments: [{ organization: { name: '虚构家庭范围部门' } }],
  },
};

const appraisalRow = {
  id: 'appraisal-1',
  employeeId: employee.id,
  appraisalPeriod: '2025年度/2026-Q1',
  appraisalType: '虚构季度绩效活动',
  score: { toNumber: () => 0 },
  employee: {
    ...employee,
    assignments: [{ organization: { name: '虚构考核范围部门' } }],
  },
};

const trainingRow = {
  id: 'training-1',
  employeeId: employee.id,
  startDate: new Date('2025-03-01T00:00:00.000Z'),
  endDate: null,
  trainingName: '虚构安全培训',
  trainingProvider: null,
  result: '合格',
  trainingType: '不应查询的字段',
  hours: 8,
  cost: 100,
  remark: '不应查询的字段',
  employee: {
    ...employee,
    assignments: [{ organization: { name: '虚构培训范围部门' } }],
  },
};

const awardRow = {
  id: 'award-1',
  employeeId: employee.id,
  awardDate: new Date('2024-12-31T00:00:00.000Z'),
  awardName: '虚构优秀贡献奖',
  reason: null,
  awardLevel: '不应查询的字段',
  awardingOrganization: '不应查询的字段',
  remark: '不应查询的字段',
  employee: {
    ...employee,
    assignments: [{ organization: { name: '虚构奖励范围部门' } }],
  },
};

const certificateRow = {
  id: 'certificate-1',
  employeeId: employee.id,
  certificateType: '不应查询的字段',
  certificateName: '虚构项目管理证书',
  certificateNo: 'FAKE-CERT-001',
  issuingAuthority: '虚构认证机构',
  issueDate: new Date('2025-05-20T00:00:00.000Z'),
  expiryDate: new Date('2028-05-19T00:00:00.000Z'),
  attachmentId: 'fake-attachment-id',
  attachment: { storageKey: 'must-not-be-read' },
  remark: '不应查询的字段',
  employee: {
    ...employee,
    assignments: [{ organization: { name: '虚构证书范围部门' } }],
  },
};

const projectRow = {
  id: 'project-1',
  employeeId: employee.id,
  startDate: new Date('2024-02-01T00:00:00.000Z'),
  endDate: new Date('2024-11-30T00:00:00.000Z'),
  projectName: '虚构人力资源平台项目',
  projectRole: '虚构项目负责人',
  projectDescription: '虚构项目经历描述',
  companyName: '不应查询的字段',
  responsibilities: '不应查询的字段',
  projectResult: '不应查询的字段',
  employee: {
    ...employee,
    assignments: [{ organization: { name: '虚构项目范围部门' } }],
  },
};

const skillRow = {
  id: 'skill-1',
  employeeId: employee.id,
  skillName: '虚构数据分析技能',
  proficiencyLevel: '熟练',
  skillCategory: null,
  yearsOfExperience: 5,
  isCertified: true,
  remark: '不应查询的字段',
  employee: {
    ...employee,
    assignments: [{ organization: { name: '虚构技能范围部门' } }],
  },
};

const languageRow = {
  id: 'language-1',
  employeeId: employee.id,
  language: '虚构语言甲',
  listeningLevel: '不应查询的字段',
  speakingLevel: '熟练',
  readingLevel: null,
  writingLevel: '良好',
  certificateName: '不应查询的字段',
  certificateScore: '不应查询的字段',
  employee: {
    ...employee,
    assignments: [{ organization: { name: '虚构语言范围部门' } }],
  },
};

describe('EmployeeSubsetsService', () => {
  it.each(methods)('%s returns an empty page in demo mode without accessing Prisma', async (method) => {
    const service = new EmployeeSubsetsService(
      inaccessibleDependency('Prisma') as never,
      inaccessibleDependency('AccessControl') as never,
      { enabled: true } as never,
    );

    await expect(service[method](user, query)).resolves.toEqual(emptyPage);
  });

  it.each(methods)('%s returns the requested page in database mode with a minimal employee select', async (method) => {
    const facts = {
      findEducation: 'education',
      findWorkHistory: 'work',
      findFamily: 'family',
      findAppraisals: 'appraisal',
      findTraining: 'training',
      findAwards: 'award',
      findCertificates: 'certificate',
      findProjects: 'project',
      findSkills: 'skill',
      findLanguages: 'language',
    } as const;
    const fact = facts[method];
    if (fact !== 'skill' && fact !== 'language') {
      const { service } = createFactService(fact);
      await expect(service[method](user, query)).resolves.toEqual(emptyPage);
      return;
    }

    const row = fact === 'skill' ? skillRow : languageRow;
    const { service, findMany, count, employeeFindMany, access } = createFactService(fact, [row]);
    employeeFindMany.mockResolvedValue([{ id: employee.id }]);
    const result = await service[method](user, {
      keyword: ' DEMO-1001 ', organizationId: 'org-child', page: 2, pageSize: 20,
    } as never);
    const findArgs = findMany.mock.calls[0][0];
    const where = findArgs.where;

    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledWith(user);
    expect(access.getOrganizationSubtreeIds).toHaveBeenCalledWith('org-child', ['org-a', 'org-child']);
    expect(where).toEqual({ AND: expect.arrayContaining([
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
      { employee: { is: { assignments: { some: expect.objectContaining({
        status: AssignmentStatus.ACTIVE,
        archivedAt: null,
        ...activeEmploymentPeriodFilter,
        organizationId: { in: ['org-child'] },
        startDate: { lte: expect.any(Date) },
        OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
      }) } } } },
      { employee: { is: { OR: [
        { employeeNo: { contains: ' DEMO-1001 ' } },
        { name: { contains: ' DEMO-1001 ' } },
      ] } } },
    ]) });
    expect(findArgs.select.employee.select).not.toHaveProperty('id');
    expect(findArgs.select.employee.select.workEmail).toBe(true);
    expect(findArgs.select.employee.select.assignments).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        isPrimary: true,
        organizationId: { in: ['org-child'] },
        status: AssignmentStatus.ACTIVE,
        archivedAt: null,
        ...activeEmploymentPeriodFilter,
      }),
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      take: 1,
    }));
    expect(count.mock.calls[0][0].where).toBe(where);
    expect(findArgs.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
    expect(findArgs.skip).toBe(20);
    expect(findArgs.take).toBe(20);
    expect(employeeFindMany).toHaveBeenCalledTimes(1);
    expect(result.data[0]).toEqual(expect.objectContaining({
      workEmail: employee.workEmail,
      departmentName: fact === 'skill' ? '虚构技能范围部门' : '虚构语言范围部门',
      approvalStatus: null,
      canViewEmployeeDetail: true,
    }));

    if (fact === 'skill') {
      expect(findArgs.select).toEqual(expect.objectContaining({
        skillName: true,
        proficiencyLevel: true,
        skillCategory: true,
      }));
      for (const field of ['yearsOfExperience', 'isCertified', 'remark']) {
        expect(findArgs.select).not.toHaveProperty(field);
      }
      expect(result.data[0]).toEqual(expect.objectContaining({
        skillName: '虚构数据分析技能',
        proficiencyLevel: '熟练',
        skillCategory: null,
      }));
    } else {
      expect(findArgs.select).toEqual(expect.objectContaining({
        language: true,
        writingLevel: true,
        readingLevel: true,
        speakingLevel: true,
      }));
      for (const field of ['listeningLevel', 'certificateName', 'certificateScore']) {
        expect(findArgs.select).not.toHaveProperty(field);
      }
      expect(result.data[0]).toEqual(expect.objectContaining({
        language: '虚构语言甲',
        nativeLanguage: null,
        proficiencyLevel: null,
        writingLevel: '良好',
        readingLevel: null,
        speakingLevel: '熟练',
      }));
    }

    const allUser = { ...user, permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.EMPLOYEE_DATA_ALL] };
    const allScope = createFactService(fact, [row], { all: true });
    const allResult = await allScope.service[method](allUser, { page: 1, pageSize: 10 } as never);
    expect(allScope.access.getAccessibleOrganizationIds).not.toHaveBeenCalled();
    expect(allScope.findMany.mock.calls[0][0].where.AND).not.toEqual(expect.arrayContaining([
      { employee: { is: { assignments: { some: expect.any(Object) } } } },
    ]));
    expect(allScope.employeeFindMany).not.toHaveBeenCalled();
    expect(allResult.data[0].canViewEmployeeDetail).toBe(true);
  });

  it.each([
    ['education' as const, 'findEducation' as const, educationRow],
    ['work' as const, 'findWorkHistory' as const, workRow],
    ['family' as const, 'findFamily' as const, familyRow],
    ['appraisal' as const, 'findAppraisals' as const, appraisalRow],
    ['training' as const, 'findTraining' as const, trainingRow],
    ['award' as const, 'findAwards' as const, awardRow],
    ['certificate' as const, 'findCertificates' as const, certificateRow],
    ['project' as const, 'findProjects' as const, projectRow],
    ['skill' as const, 'findSkills' as const, skillRow],
    ['language' as const, 'findLanguages' as const, languageRow],
  ])('%s fact query selects employeeId on the row and omits the unused employee.id', async (fact, method, row) => {
    const { service, findMany } = createFactService(fact, [row]);

    await service[method](user, { page: 1, pageSize: 10 } as never);

    const select = findMany.mock.calls[0][0].select;
    expect(select.employeeId).toBe(true);
    expect(select.employee.select).not.toHaveProperty('id');
  });

  it('filters education facts to active, unarchived employees and current authorized assignments', async () => {
    const { service, findMany, count, access } = createFactService('education', [educationRow]);
    const result = await service.findEducation(user, {
      keyword: ' DEMO-1001 ', organizationId: 'org-child', page: 2, pageSize: 20,
    } as never);

    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledWith(user);
    expect(access.getOrganizationSubtreeIds).toHaveBeenCalledWith('org-child', ['org-a', 'org-child']);
    const where = findMany.mock.calls[0][0].where;
    expect(where).toEqual({ AND: expect.arrayContaining([
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
      { employee: { is: { assignments: { some: expect.objectContaining({
        status: AssignmentStatus.ACTIVE,
        archivedAt: null,
        ...activeEmploymentPeriodFilter,
        organizationId: { in: ['org-child'] },
        startDate: { lte: expect.any(Date) },
        OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
      }) } } } },
      { employee: { is: { OR: [
        { employeeNo: { contains: ' DEMO-1001 ' } },
        { name: { contains: ' DEMO-1001 ' } },
      ] } } },
    ]) });
    expect(count.mock.calls[0][0].where).toBe(where);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ graduationDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      skip: 20,
      take: 20,
    }));
    expect(result.data[0]).toEqual(expect.objectContaining({
      schoolType: null,
      startDate: '2018-09-01',
      endDate: '2022-06-30',
      isHighestEducation: true,
    }));
  });

  it('keeps an ADMIN without employee.data.all permission in assignment scope', async () => {
    const admin = { ...user, role: 'ADMIN' as const };
    const { service, findMany, access } = createFactService('education', [educationRow]);
    await service.findEducation(admin, { page: 1, pageSize: 10 } as never);

    expect(access.hasAllEmployeeData).toHaveBeenCalledWith(admin);
    expect(access.getAccessibleOrganizationIds).toHaveBeenCalled();
    expect(findMany.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([
      { employee: { is: { assignments: { some: expect.any(Object) } } } },
    ]));
  });

  it('does not constrain fact rows or issue detail queries for employee.data.all users', async () => {
    const allUser = { ...user, permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.EMPLOYEE_DATA_ALL] };
    const { service, findMany, employeeFindMany, access } = createFactService('education', [educationRow], { all: true });
    const result = await service.findEducation(allUser, { page: 1, pageSize: 10 } as never);

    expect(access.getAccessibleOrganizationIds).not.toHaveBeenCalled();
    expect(findMany.mock.calls[0][0].where.AND).not.toEqual(expect.arrayContaining([
      { employee: { is: { assignments: { some: expect.any(Object) } } } },
    ]));
    expect(employeeFindMany).not.toHaveBeenCalled();
    expect(result.data[0].canViewEmployeeDetail).toBe(true);
  });

  it('normalizes assignment date boundaries to local-day UTC midnight for fact scope, display, and detail access', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 26, 15, 30));
    try {
      const { service, findMany, employeeFindMany } = createFactService('education', [educationRow]);
      employeeFindMany.mockResolvedValue([{ id: employee.id }]);

      await service.findEducation(user, { page: 1, pageSize: 10 } as never);

      const today = new Date('2026-08-26T00:00:00.000Z');
      const findArgs = findMany.mock.calls[0][0];
      const scopedAssignment = findArgs.where.AND.find(
        (condition: { employee?: { is?: { assignments?: unknown } } }) => condition.employee?.is?.assignments,
      ).employee.is.assignments.some;
      expect(scopedAssignment.startDate).toEqual({ lte: today });
      expect(scopedAssignment.OR).toEqual([{ endDate: null }, { endDate: { gte: today } }]);
      expect(findArgs.select.employee.select.assignments.where.startDate).toEqual({ lte: today });
      expect(findArgs.select.employee.select.assignments.where.OR).toEqual([
        { endDate: null },
        { endDate: { gte: today } },
      ]);
      const detailAssignment = employeeFindMany.mock.calls[0][0].where.assignments.some;
      expect(detailAssignment.startDate).toEqual({ lte: today });
      expect(detailAssignment.OR).toEqual([{ endDate: null }, { endDate: { gte: today } }]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses only the current in-scope primary assignment and computes current detail access in one batch', async () => {
    const row = {
      ...educationRow,
      employee: {
        ...educationRow.employee,
        assignments: [
          { organization: { name: '虚构主要部门' } },
          { organization: { name: '虚构其他部门' } },
        ],
      },
    };
    const { service, findMany, employeeFindMany } = createFactService('education', [row]);
    employeeFindMany.mockResolvedValue([{ id: employee.id }]);
    const result = await service.findEducation(user, { page: 1, pageSize: 10 } as never);

    expect(result.data[0]).toEqual(expect.objectContaining({ departmentName: '虚构主要部门', canViewEmployeeDetail: true }));
    expect(findMany.mock.calls[0][0].select.employee.select.assignments.where).toEqual(expect.objectContaining({
      isPrimary: true,
      organizationId: { in: ['org-a', 'org-child'] },
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      ...activeEmploymentPeriodFilter,
      startDate: { lte: expect.any(Date) },
      OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
    }));
    expect(employeeFindMany).toHaveBeenCalledTimes(1);
    expect(employeeFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: [employee.id] },
        recordStatus: RecordStatus.ACTIVE,
        archivedAt: null,
        assignments: { some: expect.objectContaining({
          organizationId: { in: ['org-a', 'org-child'] },
          status: AssignmentStatus.ACTIVE,
          archivedAt: null,
          ...activeEmploymentPeriodFilter,
        }) },
      },
      select: { id: true },
    });
  });

  it('does not expose an out-of-scope primary assignment or default detail access to true', async () => {
    const row = {
      ...educationRow,
      employee: { ...educationRow.employee, assignments: [] },
    };
    const { service, employeeFindMany } = createFactService('education', [row]);
    employeeFindMany.mockResolvedValue([]);

    const result = await service.findEducation(user, { page: 1, pageSize: 10 } as never);

    expect(result.data[0]).toEqual(expect.objectContaining({
      departmentName: null,
      canViewEmployeeDetail: false,
    }));
  });

  it('keeps historical facts visible to an all-data administrator but only derives department from an active employment period', async () => {
    const allUser = { ...user, permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.EMPLOYEE_DATA_ALL] };
    const historicalFact = {
      ...educationRow,
      employee: { ...educationRow.employee, assignments: [] },
    };
    const { service, findMany, employeeFindMany } = createFactService('education', [historicalFact], { all: true });

    const result = await service.findEducation(allUser, { page: 1, pageSize: 10 } as never);

    expect(findMany.mock.calls[0][0].where.AND).not.toEqual(expect.arrayContaining([
      { employee: { is: { assignments: { some: expect.any(Object) } } } },
    ]));
    expect(findMany.mock.calls[0][0].select.employee.select.assignments.where).toEqual({
      isPrimary: true,
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: expect.any(Date) },
      OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
      ...activeEmploymentPeriodFilter,
    });
    expect(employeeFindMany).not.toHaveBeenCalled();
    expect(result.data[0]).toEqual(expect.objectContaining({
      departmentName: null,
      canViewEmployeeDetail: true,
    }));
  });

  it('returns the work-history proof contact name and keeps the current job title', async () => {
    const { service, findMany } = createFactService('work', [workRow]);
    const result = await service.findWorkHistory(user, { page: 1, pageSize: 10 } as never);
    const select = findMany.mock.calls[0][0].select;

    expect(select.positionName).toBeUndefined();
    expect(select.referenceName).toBe(true);
    expect(select.referenceMobile).toBeUndefined();
    expect(result.data[0]).toEqual(expect.objectContaining({
      workEmail: employee.workEmail,
      departmentName: '虚构运营部',
      jobTitleName: '当前虚构职务',
      referenceName: '虚构证明人',
      approvalStatus: null,
    }));
  });

  it('returns an empty page for an unauthorized organization without querying facts', async () => {
    const { service, findMany, access } = createFactService('work');
    access.getOrganizationSubtreeIds.mockResolvedValue([]);
    await expect(service.findWorkHistory(user, { organizationId: 'org-outside', page: 4, pageSize: 15 } as never))
      .resolves.toEqual({ data: [], meta: { page: 4, pageSize: 15, total: 0, totalPages: 0 } });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('uses the same where for work-history findMany and count and applies stable date pagination ordering', async () => {
    const { service, findMany, count } = createFactService('work', [workRow]);
    await service.findWorkHistory(user, { keyword: '虚构', page: 3, pageSize: 5 } as never);
    const findArgs = findMany.mock.calls[0][0];

    expect(count.mock.calls[0][0].where).toBe(findArgs.where);
    expect(findArgs.orderBy).toEqual([
      { startDate: 'desc' },
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
    expect(findArgs.skip).toBe(10);
    expect(findArgs.take).toBe(5);
  });

  it.each([
    {
      fact: 'family' as const,
      method: 'findFamily' as const,
      row: familyRow,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      departmentName: '虚构家庭范围部门',
    },
    {
      fact: 'appraisal' as const,
      method: 'findAppraisals' as const,
      row: appraisalRow,
      orderBy: [{ appraisalDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      departmentName: '虚构考核范围部门',
    },
    {
      fact: 'training' as const,
      method: 'findTraining' as const,
      row: trainingRow,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      departmentName: '虚构培训范围部门',
    },
    {
      fact: 'award' as const,
      method: 'findAwards' as const,
      row: awardRow,
      orderBy: [{ awardDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      departmentName: '虚构奖励范围部门',
    },
  ])('applies fact, employee, organization, keyword, pagination, and detail scope to $fact rows', async ({
    fact, method, row, orderBy, departmentName,
  }) => {
    const { service, findMany, count, employeeFindMany, access } = createFactService(fact, [row]);
    employeeFindMany.mockResolvedValue([{ id: employee.id }]);

    const result = await service[method](user, {
      keyword: ' DEMO-1001 ', organizationId: 'org-child', page: 2, pageSize: 20,
    } as never);
    const findArgs = findMany.mock.calls[0][0];
    const where = findArgs.where;

    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledWith(user);
    expect(access.getOrganizationSubtreeIds).toHaveBeenCalledWith('org-child', ['org-a', 'org-child']);
    expect(where).toEqual({ AND: expect.arrayContaining([
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
      { employee: { is: { assignments: { some: expect.objectContaining({
        status: AssignmentStatus.ACTIVE,
        archivedAt: null,
        ...activeEmploymentPeriodFilter,
        organizationId: { in: ['org-child'] },
        startDate: { lte: expect.any(Date) },
        OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
      }) } } } },
      { employee: { is: { OR: [
        { employeeNo: { contains: ' DEMO-1001 ' } },
        { name: { contains: ' DEMO-1001 ' } },
      ] } } },
    ]) });
    expect(findArgs.select.employee.select).not.toHaveProperty('id');
    expect(findArgs.select.employee.select.workEmail).toBe(true);
    expect(findArgs.select.employee.select.assignments).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        isPrimary: true,
        organizationId: { in: ['org-child'] },
        status: AssignmentStatus.ACTIVE,
        archivedAt: null,
        ...activeEmploymentPeriodFilter,
      }),
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      take: 1,
    }));
    expect(count.mock.calls[0][0].where).toBe(where);
    expect(findArgs.orderBy).toEqual(orderBy);
    expect(findArgs.skip).toBe(20);
    expect(findArgs.take).toBe(20);
    expect(employeeFindMany).toHaveBeenCalledTimes(1);
    expect(result.data[0]).toEqual(expect.objectContaining({
      workEmail: employee.workEmail,
      departmentName,
      canViewEmployeeDetail: true,
    }));
  });

  it.each([
    {
      fact: 'training' as const,
      method: 'findTraining' as const,
      row: trainingRow,
      expected: {
        startDate: '2025-03-01',
        endDate: null,
        trainingName: '虚构安全培训',
        trainingProvider: null,
        trainingResult: '合格',
        approvalStatus: null,
        credits: null,
      },
      forbidden: ['trainingType', 'hours', 'cost', 'remark'],
    },
    {
      fact: 'award' as const,
      method: 'findAwards' as const,
      row: awardRow,
      expected: {
        awardDate: '2024-12-31',
        awardName: '虚构优秀贡献奖',
        summary: null,
        approvalStatus: null,
      },
      forbidden: ['awardLevel', 'awardingOrganization', 'remark'],
    },
  ])('maps the approved $fact list fields and selects no unrelated facts', async ({
    fact, method, row, expected, forbidden,
  }) => {
    const { service, findMany, count, employeeFindMany } = createFactService(fact, [row]);
    employeeFindMany.mockResolvedValue([{ id: employee.id }]);

    const result = await service[method](user, { keyword: 'DEMO-1001', page: 2, pageSize: 5 } as never);
    const findArgs = findMany.mock.calls[0][0];

    expect(findArgs.select).toEqual(expect.objectContaining({
      id: true,
      employeeId: true,
      employee: expect.any(Object),
    }));
    for (const field of forbidden) expect(findArgs.select).not.toHaveProperty(field);
    expect(findArgs.select.employee.select).not.toHaveProperty('id');
    expect(findArgs.select.employee.select.workEmail).toBe(true);
    expect(findArgs.select.employee.select.assignments).toEqual(expect.objectContaining({
      where: expect.objectContaining({ isPrimary: true }),
      take: 1,
    }));
    expect(count.mock.calls[0][0].where).toBe(findArgs.where);
    expect(result.data[0]).toEqual(expect.objectContaining({
      ...expected,
      workEmail: employee.workEmail,
      departmentName: expect.any(String),
      canViewEmployeeDetail: true,
    }));
  });

  it('returns standard and nonstandard family mobiles in full', async () => {
    const nonstandardMobile = '010-12345678';
    const { service, findMany } = createFactService('family', [
      familyRow,
      { ...familyRow, id: 'family-2', mobile: nonstandardMobile },
      { ...familyRow, id: 'family-3', mobile: null },
    ]);
    const result = await service.findFamily(user, { page: 1, pageSize: 10 } as never);
    const select = findMany.mock.calls[0][0].select;

    expect(select).toEqual(expect.objectContaining({
      name: true,
      relationship: true,
      gender: true,
      mobile: true,
    }));
    expect(select).not.toHaveProperty('identityDocumentNo');
    expect(select).not.toHaveProperty('address');
    expect(select).not.toHaveProperty('birthDate');
    expect(select).not.toHaveProperty('remark');
    expect(result.data[0]).toEqual(expect.objectContaining({
      memberName: '虚构家属甲',
      relationshipName: '母亲',
      gender: 'FEMALE',
      mobile: '13912345678',
      approvalStatus: null,
    }));
    expect(result.data[1].mobile).toBe(nonstandardMobile);
    expect(result.data[2].mobile).toBeNull();
  });

  it('maps certificates with scope, current primary department, work email, and stable pagination ordering', async () => {
    const { service, findMany, count, employeeFindMany, access } = createFactService('certificate', [certificateRow]);
    employeeFindMany.mockResolvedValue([{ id: employee.id }]);
    const result = await service.findCertificates(user, {
      keyword: ' DEMO-1001 ', organizationId: 'org-child', page: 2, pageSize: 20,
    } as never);
    const findArgs = findMany.mock.calls[0][0];

    expect(access.getOrganizationSubtreeIds).toHaveBeenCalledWith('org-child', ['org-a', 'org-child']);
    expect(findArgs.where).toEqual({ AND: expect.arrayContaining([
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
      { employee: { is: { assignments: { some: expect.objectContaining({
        organizationId: { in: ['org-child'] },
        ...activeEmploymentPeriodFilter,
      }) } } } },
      { employee: { is: { OR: [
        { employeeNo: { contains: ' DEMO-1001 ' } },
        { name: { contains: ' DEMO-1001 ' } },
      ] } } },
    ]) });
    expect(findArgs.select.employee.select).not.toHaveProperty('id');
    expect(findArgs.select.employee.select.workEmail).toBe(true);
    expect(findArgs.select.employee.select.assignments).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        isPrimary: true,
        organizationId: { in: ['org-child'] },
        ...activeEmploymentPeriodFilter,
      }),
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      take: 1,
    }));
    expect(findArgs.orderBy).toEqual([{ issueDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }]);
    expect(findArgs.skip).toBe(20);
    expect(findArgs.take).toBe(20);
    expect(count.mock.calls[0][0].where).toBe(findArgs.where);
    expect(employeeFindMany).toHaveBeenCalledTimes(1);
    expect(result.data[0]).toEqual(expect.objectContaining({
      employeeName: employee.name,
      employeeNo: employee.employeeNo,
      workEmail: employee.workEmail,
      departmentName: '虚构证书范围部门',
      certificateName: '虚构项目管理证书',
      certificateNo: 'FAKE-CERT-001',
      issuingAuthority: '虚构认证机构',
      issueDate: '2025-05-20',
      expiryDate: '2028-05-19',
      approvalStatus: null,
      canViewEmployeeDetail: true,
    }));
  });

  it('selects and returns certificate numbers and never selects excluded certificate fields', async () => {
    const { service, findMany } = createFactService('certificate', [certificateRow]);
    const result = await service.findCertificates(user, { page: 1, pageSize: 10 } as never);
    const select = findMany.mock.calls[0][0].select;

    expect(select.certificateNo).toBe(true);
    expect(select).not.toHaveProperty('certificateType');
    expect(select).not.toHaveProperty('attachmentId');
    expect(select).not.toHaveProperty('attachment');
    expect(select).not.toHaveProperty('remark');
    expect(result.data[0].certificateNo).toBe('FAKE-CERT-001');
  });

  it('maps projects with dates, null approval, current primary department, and no excluded project fields', async () => {
    const { service, findMany, count, employeeFindMany } = createFactService('project', [projectRow]);
    employeeFindMany.mockResolvedValue([{ id: employee.id }]);
    const result = await service.findProjects(user, { keyword: 'DEMO-1001', page: 3, pageSize: 5 } as never);
    const findArgs = findMany.mock.calls[0][0];
    const select = findArgs.select;

    expect(select).toEqual(expect.objectContaining({
      id: true,
      employeeId: true,
      startDate: true,
      endDate: true,
      projectName: true,
      projectRole: true,
      projectDescription: true,
      employee: expect.any(Object),
    }));
    expect(select).not.toHaveProperty('companyName');
    expect(select).not.toHaveProperty('responsibilities');
    expect(select).not.toHaveProperty('projectResult');
    expect(findArgs.orderBy).toEqual([{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }]);
    expect(findArgs.skip).toBe(10);
    expect(findArgs.take).toBe(5);
    expect(count.mock.calls[0][0].where).toBe(findArgs.where);
    expect(result.data[0]).toEqual(expect.objectContaining({
      workEmail: employee.workEmail,
      departmentName: '虚构项目范围部门',
      startDate: '2024-02-01',
      endDate: '2024-11-30',
      projectName: '虚构人力资源平台项目',
      projectRole: '虚构项目负责人',
      description: '虚构项目经历描述',
      approvalStatus: null,
    }));
  });

  it('returns an empty certificate page for an unauthorized organization without querying its delegate', async () => {
    const { service, findMany, access } = createFactService('certificate');
    access.getOrganizationSubtreeIds.mockResolvedValue([]);
    await expect(service.findCertificates(user, { organizationId: 'org-outside', page: 4, pageSize: 15 } as never))
      .resolves.toEqual({ data: [], meta: { page: 4, pageSize: 15, total: 0, totalPages: 0 } });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns an empty project page for an employee.data.all user when no rows exist without resolving organization scope', async () => {
    const allUser = { ...user, permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.EMPLOYEE_DATA_ALL] };
    const { service, access } = createFactService('project', [], { all: true });
    await expect(service.findProjects(allUser, { page: 1, pageSize: 10 } as never))
      .resolves.toEqual({ data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
    expect(access.getAccessibleOrganizationIds).not.toHaveBeenCalled();
  });

  it('returns standard and nonstandard family mobiles verbatim and keeps null', async () => {
    const { service } = createFactService(
      'family',
      [
        familyRow,
        { ...familyRow, id: 'family-2', mobile: '010-12345678' },
        { ...familyRow, id: 'family-3', mobile: null },
      ],
    );
    const result = await service.findFamily(user, { page: 1, pageSize: 10 } as never);

    expect(result.data[0].mobile).toBe('13912345678');
    expect(result.data[1].mobile).toBe('010-12345678');
    expect(result.data[2].mobile).toBeNull();
  });

  it('returns appraisal score and excludes unrelated appraisal details', async () => {
    const { service, findMany } = createFactService('appraisal', [appraisalRow]);
    const result = await service.findAppraisals(user, { page: 1, pageSize: 10 } as never);
    const select = findMany.mock.calls[0][0].select;

    expect(select.score).toBe(true);
    expect(select).not.toHaveProperty('grade');
    expect(select).not.toHaveProperty('result');
    expect(select).not.toHaveProperty('comment');
    expect(select).not.toHaveProperty('evaluator');
    expect(select).not.toHaveProperty('evaluatorUserId');
    expect(select).not.toHaveProperty('appraisalDate');
    expect(result.data[0]).toEqual(expect.objectContaining({
      appraisalYear: 2025,
      periodName: '2025年度/2026-Q1',
      performanceActivity: '虚构季度绩效活动',
      appraisalDepartment: null,
      finalScore: 0,
      startDate: null,
      endDate: null,
    }));
  });

  it('extracts appraisal years and converts Decimal-like scores', async () => {
    const rows = [
      appraisalRow,
      {
        ...appraisalRow,
        id: 'appraisal-2',
        appraisalPeriod: '虚构无年份季度',
        score: { toNumber: () => 87.5 },
      },
    ];
    const { service, findMany } = createFactService('appraisal', rows);
    const result = await service.findAppraisals(user, { page: 1, pageSize: 10 } as never);

    expect(findMany.mock.calls[0][0].select.score).toBe(true);
    expect(result.data.map(({ appraisalYear, finalScore }) => ({ appraisalYear, finalScore }))).toEqual([
      { appraisalYear: 2025, finalScore: 0 },
      { appraisalYear: null, finalScore: 87.5 },
    ]);
  });
});
