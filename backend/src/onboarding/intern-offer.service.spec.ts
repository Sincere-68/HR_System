import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EmploymentRelationship, Prisma, ProcessStatus, RecordStatus } from '@prisma/client';
import { OnboardingService } from './onboarding.service';

const user = {
  id: 'user-1',
  username: 'creator',
  displayName: '虚构创建人',
  role: 'DEPT_ADMIN' as const,
  roleName: '部门管理员',
  permissions: ['employee.create'] as never,
  organizationIds: ['org-a'],
};

const input = {
  name: '虚构实习候选人',
  mobile: '13900001001',
  personalEmail: 'fictional.intern@example.invalid',
  source: 'SOCIAL_RECRUITMENT' as const,
  gender: 'FEMALE' as const,
  birthDate: '2002-01-01',
  workStartDate: '2025-06-01',
  identityDocument: { documentType: 'NATIONAL_ID' as const, documentNumber: 'TEST-IDENTITY-001', isPrimary: true, expiryDate: '2036-01-01' },
  educationExperience: { schoolName: '虚构大学', educationLevel: 'BACHELOR' as const, major: '虚构专业', graduationDate: '2026-06-30', isHighestEducation: true },
  organizationId: 'org-a',
  positionId: 'position-1',
  workplaceId: 'workplace-1',
  proposedEntryDate: '2026-09-01',
  probationMonths: 3,
  jobLevel: 'S1' as const,
  employeeLevel: 'STAFF' as const,
  personnelCategory: 'TALENT_PROGRAM' as const,
  workArrangement: 'INTERN' as const,
  directManagerEmployeeId: 'manager-1',
  employingCompanyId: 'company-1',
  agreementType: 'LABOR_CONTRACT' as const,
  contractTermType: 'FIXED' as const,
  contractMonths: 12,
  contractEndDate: '2027-09-01',
  isSeparatelySigned: true,
  compensationSnapshot: { salaryPackage: '实习薪资包', salaryRemark: '虚构备注', preConfirmationBaseSalary: '0.00', postConfirmationBaseSalary: '8000.00', preConfirmationMonthlyPerformance: '0', postConfirmationMonthlyPerformance: '1000.50', preConfirmationMonthlyManagementPerformance: '0', postConfirmationMonthlyManagementPerformance: '0', fullTimeContractSalary: '9500.00', annualPerformance: '12000.00' },
  partTimeSnapshot: { positionName: '虚构非全职位', hourlyRate: '88.50' },
};

type TransactionOperation = (tx: Record<string, unknown>) => Promise<unknown>;

function createService(demoEnabled = false) {
  const prisma = {
    organization: { findMany: jest.fn() },
    position: { findMany: jest.fn() },
    workplace: { findMany: jest.fn() },
    employee: { findMany: jest.fn(), findFirst: jest.fn() },
    employingCompany: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const access = {
    hasAllEmployeeData: jest.fn(() => false),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
    getEmployeeWhere: jest.fn().mockResolvedValue({ assignments: { some: { organizationId: { in: ['org-a', 'org-child'] } } } }),
  };
  return { service: new OnboardingService(prisma as never, access as never, { enabled: demoEnabled } as never), prisma, access };
}

function validTransaction(overrides: Record<string, unknown> = {}) {
  return {
    organization: { findFirst: jest.fn().mockResolvedValue({ id: 'org-a' }) },
    position: { findFirst: jest.fn().mockResolvedValue({ id: 'position-1' }) },
    workplace: { findFirst: jest.fn().mockResolvedValue({ id: 'workplace-1' }) },
    employingCompany: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }) },
    employee: { findFirst: jest.fn().mockResolvedValue({ id: 'manager-1' }) },
    offer: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: 'offer-1', offerNo: 'INTERN-20260901-0001', organizationId: 'org-a', positionId: 'position-1', workplaceId: 'workplace-1',
        proposedEntryDate: new Date('2026-09-01T00:00:00.000Z'), probationMonths: 3, jobLevel: 'S1', employeeLevel: 'STAFF',
        personnelCategory: 'TALENT_PROGRAM', workArrangement: 'INTERN', directManagerEmployeeId: 'manager-1', employingCompanyId: 'company-1',
        agreementType: 'LABOR_CONTRACT', contractTermType: 'FIXED', contractMonths: 12, contractEndDate: new Date('2027-09-01T00:00:00.000Z'),
        isSeparatelySigned: true, employmentRelationship: EmploymentRelationship.INTERN, status: ProcessStatus.DRAFT, issueDate: null,
      }),
    },
    candidate: { create: jest.fn().mockResolvedValue({ id: 'candidate-1', name: input.name, mobile: input.mobile, email: input.personalEmail, source: input.source, gender: input.gender, birthDate: new Date('2002-01-01T00:00:00.000Z'), workStartDate: new Date('2025-06-01T00:00:00.000Z') }) },
    candidateIdentityDocument: { create: jest.fn().mockResolvedValue({ id: 'candidate-document-1', ...input.identityDocument, documentNumber: input.identityDocument.documentNumber, expiryDate: new Date('2036-01-01T00:00:00.000Z') }) },
    candidateEducationExperience: { create: jest.fn().mockResolvedValue({ id: 'candidate-education-1', ...input.educationExperience, graduationDate: new Date('2026-06-30T00:00:00.000Z') }) },
    offerCompensationSnapshot: { create: jest.fn().mockResolvedValue({ ...input.compensationSnapshot, preConfirmationBaseSalary: new Prisma.Decimal('0.00'), postConfirmationBaseSalary: new Prisma.Decimal('8000.00'), preConfirmationMonthlyPerformance: new Prisma.Decimal('0'), postConfirmationMonthlyPerformance: new Prisma.Decimal('1000.50'), preConfirmationMonthlyManagementPerformance: new Prisma.Decimal('0'), postConfirmationMonthlyManagementPerformance: new Prisma.Decimal('0'), fullTimeContractSalary: new Prisma.Decimal('9500'), annualPerformance: new Prisma.Decimal('12000') }) },
    offerPartTimeSnapshot: { create: jest.fn().mockResolvedValue({ positionName: '虚构非全职位', hourlyRate: new Prisma.Decimal('88.50') }) },
    employeeAssignment: { create: jest.fn() },
    reportingRelationship: { create: jest.fn() },
    employeeAgreement: { create: jest.fn() },
    onboardingCase: { create: jest.fn() },
    approvalRequest: { create: jest.fn() },
    approvalStep: { create: jest.fn() },
    ...overrides,
  };
}

function useTransaction(prisma: ReturnType<typeof createService>['prisma'], tx: Record<string, unknown>) {
  prisma.$transaction.mockImplementation((operation: TransactionOperation) => operation(tx));
}

const prefillEmployee = {
  name: '虚构实习生', mobile: '13900001002', personalEmail: 'intern@example.invalid', gender: 'FEMALE', birthDate: new Date('2002-01-01T00:00:00.000Z'),
  identityDocuments: [{ documentType: 'PASSPORT', documentNumber: 'TEST-PASSPORT-1', expiryDate: new Date('2036-01-01T00:00:00.000Z') }],
  educationExperiences: [{ schoolName: '虚构大学', educationLevel: 'BACHELOR', major: '虚构专业', graduationDate: new Date('2026-06-30T00:00:00.000Z') }],
  employmentPeriods: [{
    id: 'period-1', personnelCategory: 'TALENT_PROGRAM', personnelSource: 'INTERNAL_REFERRAL',
    assignments: [{ organizationId: 'org-a', positionId: 'position-1', workplaceId: 'workplace-1', jobLevel: 'S1', employeeLevel: 'STAFF', personnelCategory: 'TALENT_PROGRAM', workArrangement: 'INTERN' }],
  }],
  reportingAsEmployee: [{ managerEmployeeId: 'manager-1' }],
  agreements: [{ employmentPeriodId: 'period-1', employingCompanyId: 'company-1', agreementType: 'INTERNSHIP_AGREEMENT', endDate: new Date('2026-12-31T00:00:00.000Z') }],
};

describe('OnboardingService direct internship Offer creation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects direct Offer reads and creation in demo mode without accessing Prisma', async () => {
    const { service, prisma } = createService(true);
    await expect(service.getInternOfferFormOptions(user)).rejects.toEqual(expect.objectContaining({ status: 409, message: '新建实习Offer仅支持 MySQL 模式' }));
    await expect(service.getInternConversionOptions(user)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.getInternConversionOfferPrefill(user, 'intern-1')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.createInternOffer(user, input as never)).rejects.toEqual(expect.objectContaining({ status: 409, message: '新建实习Offer仅支持 MySQL 模式' }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns active options with accessible manager choices and workplace addresses', async () => {
    const { service, prisma, access } = createService();
    prisma.$transaction.mockResolvedValue([
      [{ id: 'org-a', name: '虚构授权部门' }], [{ id: 'position-1', code: '00001', name: '虚构通用职位', organizationId: null }],
      [{ id: 'workplace-1', name: '虚构园区', address: '虚构园区地址' }], [{ id: 'manager-1', name: '虚构经理', employeeNo: 'FAKE-M001' }], [{ id: 'company-1', name: '虚构全日制公司' }],
    ]);
    await expect(service.getInternOfferFormOptions(user)).resolves.toEqual({
      organizations: [{ id: 'org-a', name: '虚构授权部门' }], positions: [{ id: 'position-1', code: '00001', name: '虚构通用职位', organizationId: null }],
      workplaces: [{ id: 'workplace-1', name: '虚构园区', address: '虚构园区地址' }], managers: [{ id: 'manager-1', name: '虚构经理', employeeNo: 'FAKE-M001' }], employingCompanies: [{ id: 'company-1', name: '虚构全日制公司' }],
    });
    expect(access.getEmployeeWhere).toHaveBeenCalledWith(user, ['org-a', 'org-child']);
  });

  it('creates only Candidate, Candidate snapshots, Offer and Offer snapshots without any template query', async () => {
    const { service, prisma } = createService();
    const tx = validTransaction();
    useTransaction(prisma, tx);
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2026);
    jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(8);
    jest.spyOn(Date.prototype, 'getDate').mockReturnValue(1);
    const result = await service.createInternOffer(user, input as never);

    expect(result).toMatchObject({ id: 'offer-1', employmentRelationship: 'INTERN', status: 'DRAFT', candidate: { source: 'SOCIAL_RECRUITMENT' }, workplaceId: 'workplace-1' });
    expect((tx.offer as { create: jest.Mock }).create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ employmentRelationship: EmploymentRelationship.INTERN }) }));
    expect(Object.keys(prisma)).not.toContain('offer' + 'Template');
    for (const relation of ['employeeAssignment', 'reportingRelationship', 'employeeAgreement', 'onboardingCase', 'approvalRequest', 'approvalStep'] as const) {
      expect((tx[relation] as { create: jest.Mock }).create).not.toHaveBeenCalled();
    }
  });

  it('creates a direct Offer with an omitted optional workplace and persists null', async () => {
    const { service, prisma } = createService();
    const tx = validTransaction();
    (tx.offer as { create: jest.Mock }).create.mockResolvedValue({
      id: 'offer-1', offerNo: 'INTERN-20260901-0001', organizationId: 'org-a', positionId: 'position-1', workplaceId: null,
      proposedEntryDate: new Date('2026-09-01T00:00:00.000Z'), probationMonths: null, jobLevel: null, employeeLevel: null, personnelCategory: null, workArrangement: null, directManagerEmployeeId: null, employingCompanyId: null, agreementType: null, contractTermType: null, contractMonths: null, contractEndDate: null, isSeparatelySigned: null, employmentRelationship: EmploymentRelationship.INTERN, status: ProcessStatus.DRAFT, issueDate: null,
    });
    useTransaction(prisma, tx);
    await expect(service.createInternOffer(user, { ...input, workplaceId: undefined, directManagerEmployeeId: undefined, employingCompanyId: undefined, agreementType: undefined, contractTermType: undefined, contractMonths: undefined, contractEndDate: undefined, compensationSnapshot: undefined, partTimeSnapshot: undefined } as never)).resolves.toMatchObject({ workplaceId: null });
    expect((tx.workplace as { findFirst: jest.Mock }).findFirst).not.toHaveBeenCalled();
    expect((tx.offer as { create: jest.Mock }).create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workplaceId: null }) }));
  });

  it.each([
    ['organization', { organization: { findFirst: jest.fn().mockResolvedValue(null) } }, '录用部门不存在、已停用或已归档'],
    ['position', { position: { findFirst: jest.fn().mockResolvedValue(null) } }, '录用职位不存在、已停用或已归档'],
    ['workplace', { workplace: { findFirst: jest.fn().mockResolvedValue(null) } }, '工作地点不存在、已停用或已归档'],
  ])('rejects unavailable %s relation before writes', async (_relation, override, message) => {
    const { service, prisma } = createService();
    const tx = validTransaction(override);
    useTransaction(prisma, tx);
    await expect(service.createInternOffer(user, input as never)).rejects.toEqual(expect.objectContaining({ status: 400, message }));
    expect((tx.candidate as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it('rejects department outside scoped organization tree before writes', async () => {
    const { service, prisma, access } = createService();
    access.getAccessibleOrganizationIds.mockResolvedValue(['org-child']);
    const tx = validTransaction();
    useTransaction(prisma, tx);
    await expect(service.createInternOffer(user, input as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reads only current scoped interns as conversion options', async () => {
    const { service, prisma, access } = createService();
    prisma.employee.findMany.mockResolvedValue([{ id: 'intern-1', name: '虚构实习生', employeeNo: 'FAKE-I001' }]);
    await expect(service.getInternConversionOptions(user)).resolves.toEqual([{ id: 'intern-1', name: '虚构实习生', employeeNo: 'FAKE-I001' }]);
    expect(access.getEmployeeWhere).toHaveBeenCalledWith(user, undefined, expect.any(Date));
    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ employmentPeriods: { some: expect.objectContaining({ employmentRelationship: EmploymentRelationship.INTERN }) } }) }));
  });

  it('returns mapped prefill values from a current scoped intern without writes', async () => {
    const { service, prisma } = createService();
    prisma.employee.findFirst.mockResolvedValue(prefillEmployee);
    await expect(service.getInternConversionOfferPrefill(user, 'intern-1')).resolves.toEqual({
      name: '虚构实习生', mobile: '13900001002', personalEmail: 'intern@example.invalid', source: 'INTERNAL_REFERRAL', gender: 'FEMALE', birthDate: '2002-01-01',
      identityDocument: { documentType: 'PASSPORT', documentNumber: 'TEST-PASSPORT-1', isPrimary: true, expiryDate: '2036-01-01' },
      educationExperience: { schoolName: '虚构大学', educationLevel: 'BACHELOR', major: '虚构专业', graduationDate: '2026-06-30', isHighestEducation: true },
      organizationId: 'org-a', positionId: 'position-1', workplaceId: 'workplace-1', jobLevel: 'S1', employeeLevel: 'STAFF', personnelCategory: 'TALENT_PROGRAM', workArrangement: 'INTERN', directManagerEmployeeId: 'manager-1', employingCompanyId: 'company-1', agreementType: 'INTERNSHIP_AGREEMENT', contractTermType: 'FIXED', contractEndDate: '2026-12-31',
    });
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'intern-1', employmentPeriods: { some: expect.objectContaining({ employmentRelationship: EmploymentRelationship.INTERN }) } }), select: expect.objectContaining({ reportingAsEmployee: expect.objectContaining({ where: expect.objectContaining({ relationshipType: 'ADMINISTRATIVE', isPrimary: true }) }) }) }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an out-of-scope or no-longer-current intern prefill without writes', async () => {
    const { service, prisma } = createService();
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(service.getInternConversionOfferPrefill(user, 'outside-intern')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('retries after an offer-number P2002 without persisting a template or source path', async () => {
    const { service, prisma } = createService();
    const conflict = new Prisma.PrismaClientKnownRequestError('unique offer number', { code: 'P2002', clientVersion: 'test', meta: { target: ['offer_no'] } });
    const tx = validTransaction({ offer: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockRejectedValueOnce(conflict).mockResolvedValue(validTransaction().offer.create()) } });
    useTransaction(prisma, tx);
    await expect(service.createInternOffer(user, input as never)).resolves.toMatchObject({ employmentRelationship: 'INTERN' });
    expect((tx.offer as { create: jest.Mock }).create).toHaveBeenCalledTimes(2);
  });

  it('does not map legacy email or creation path fields when called directly', async () => {
    const { service, prisma } = createService();
    const tx = validTransaction();
    useTransaction(prisma, tx);
    await service.createInternOffer(user, { ...input, email: 'legacy@example.invalid', creationPath: 'NEW_HIRE' } as never);
    expect((tx.candidate as { create: jest.Mock }).create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: input.personalEmail, source: input.source }) }));
  });

  it.each(['OPEN_ENDED', 'FIXED'] as const)('retains contract validation for %s direct Offers', async (contractTermType) => {
    const { service } = createService();
    const invalid = contractTermType === 'OPEN_ENDED'
      ? { ...input, contractTermType, contractMonths: 12, contractEndDate: undefined }
      : { ...input, contractTermType, contractMonths: undefined, contractEndDate: undefined };
    await expect(service.createInternOffer(user, invalid as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});
