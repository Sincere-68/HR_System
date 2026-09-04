import { ConflictException } from '@nestjs/common';
import { AgreementStatus, AssignmentStatus, EmploymentStatus, ProcessStatus, RecordStatus } from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { OnboardingService } from './onboarding.service';

const query = { view: 'PENDING_SEND' as const, page: 2, pageSize: 20 };

const emptyOfferViewCounts = {
  pendingSend: 0,
  sent: 0,
  accepted: 0,
  rejected: 0,
  onboarded: 0,
  all: 0,
};
const user = {
  id: 'user-1',
  username: 'viewer',
  displayName: '查看者',
  role: 'VIEWER' as const,
  roleName: '查看者',
  permissions: ['employee.read'] as never,
  organizationIds: ['org-a'],
};

function createService(demoEnabled: boolean, overrides: Record<string, unknown> = {}) {
  const prisma = {
    organization: { findMany: jest.fn() },
    offer: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    onboardingCase: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    onboardingIntegrationRecord: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    employeeIntroduction: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    employeeIdentityDocument: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    fileAttachment: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    ...overrides,
  };
  const access = {
    hasAllEmployeeData: jest.fn(() => false),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
  };
  const service = new OnboardingService(
    prisma as never,
    access as never,
    { enabled: demoEnabled } as never,
  );
  return { service, prisma, access };
}

describe('OnboardingService exports', () => {
  it('exports only selected fields from the active Offer view', async () => {
    const offer = {
      id: 'offer-1', name: '虚构候选人', personalEmail: 'candidate@example.invalid', mobile: null,
      gender: null, organizationName: null, appliedPositionName: null, offeredPositionName: null,
      workplaceName: null, proposedEntryDate: null, probationMonths: null, offerSenderName: null,
      issueDate: null, recommenderName: null, acceptedAt: null, syncStatus: null, rejectedAt: null,
      rejectedReason: null, entryDate: null, approvalStatus: null, currentApproverName: null,
      offerStatus: 'DRAFT' as const, resumeInfo: null,
    };
    const { service } = createService(false);
    jest.spyOn(service, 'findOffers').mockResolvedValue({
      data: [offer],
      meta: { page: 1, pageSize: 10_000, total: 1, totalPages: 1, viewCounts: emptyOfferViewCounts },
    });

    const result = await service.exportOffers(user, {
      format: 'CSV',
      fields: ['name', 'personalEmail'],
      query: { view: 'PENDING_SEND' },
    });

    expect(result.buffer.toString('utf8')).toContain('姓名');
    expect(result.buffer.toString('utf8')).toContain('个人邮箱');
    expect(result.buffer.toString('utf8')).not.toContain('录用部门');
    expect(result.buffer.toString('utf8')).toContain('candidate@example.invalid');
  });
});

describe('OnboardingService', () => {
  const methods = [
    'findOffers',
    'findEntries',
    'findIntegration',
    'findIntroduction',
    'findIdCardReader',
  ] as const;
  const onboardingQuery = { page: 2, pageSize: 20 };

  it.each(methods)('rejects %s in demo mode without accessing Prisma', async (method) => {
    const { service, prisma } = createService(true);

    await expect(service[method](user, method === 'findOffers' ? query : onboardingQuery)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
    expect(prisma.offer.findMany).not.toHaveBeenCalled();
    expect(prisma.onboardingCase.findMany).not.toHaveBeenCalled();
    expect(prisma.onboardingIntegrationRecord.findMany).not.toHaveBeenCalled();
    expect(prisma.employeeIntroduction.findMany).not.toHaveBeenCalled();
    expect(prisma.employeeIdentityDocument.findMany).not.toHaveBeenCalled();
  });

  it.each(methods)('returns an empty page for %s in database mode', async (method) => {
    const { service, prisma } = createService(false);

    await expect(service[method](user, method === 'findOffers' ? query : onboardingQuery)).resolves.toEqual(
      method === 'findOffers'
        ? {
          data: [],
          meta: { page: 2, pageSize: 20, total: 0, totalPages: 0, viewCounts: emptyOfferViewCounts },
        }
        : {
          data: [],
          meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
        },
    );
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('queries scoped non-archived offers with the exact page shape and ordering', async () => {
    const { service, prisma, access } = createService(false);
    prisma.offer.findMany.mockResolvedValue([]);
    prisma.offer.count.mockResolvedValue(0);

    await service.findOffers(user, query);

    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledWith(user);
    expect(prisma.offer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { archivedAt: null, organizationId: { in: ['org-a', 'org-child'] } },
          { acceptedAt: null },
          { issueDate: null },
        ]),
      }),
      select: expect.objectContaining({
        id: true,
        status: true,
        proposedEntryDate: true,
        probationMonths: true,
        issueDate: true,
        acceptedAt: true,
        rejectedReason: true,
        candidate: { select: { name: true, mobile: true, email: true, resumeAttachmentId: true } },
        acceptedEmployee: { select: { gender: true } },
        organization: { select: { name: true } },
        position: { select: { name: true } },
        workplaceName: true,
      }),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: 20,
      take: 20,
    }));
    expect(prisma.offer.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.any(Array) }),
    }));
  });

  it('selects Offer candidate fields without a separate field permission', async () => {
    const { service, prisma } = createService(false);

    await service.findOffers(user, { page: 1, pageSize: 10 });

    const candidateSelect = prisma.offer.findMany.mock.calls[0][0].select.candidate.select;
    expect(candidateSelect).toEqual({ name: true, mobile: true, email: true, resumeAttachmentId: true });
    expect(prisma.fileAttachment.findMany).not.toHaveBeenCalled();
  });

  it('does not restrict users with all employee-data permission and maps candidate fields', async () => {
    const { service, prisma, access } = createService(false);
    access.hasAllEmployeeData.mockReturnValue(true);
    const proposedEntryDate = new Date('2026-09-03T00:00:00.000Z');
    prisma.offer.findMany.mockResolvedValue([{
      id: 'offer-1',
      status: ProcessStatus.DRAFT,
      proposedEntryDate,
      probationMonths: 3,
      issueDate: null,
      acceptedAt: null,
      rejectedReason: null,
      candidate: { name: '虚构候选人甲', mobile: '13900000001', email: 'candidate@example.test', resumeAttachmentId: 'attachment-1' },
      acceptedEmployee: null,
      organization: null,
      position: null,
      workplaceName: null,
      onboardingCase: null,
    }]);
    prisma.offer.count.mockResolvedValue(1);

    await expect(service.findOffers(
      { ...user, role: 'ADMIN', permissions: [PERMISSIONS.EMPLOYEE_DATA_ALL] },
      { view: 'PENDING_SEND', page: 1, pageSize: 10 },
    )).resolves.toEqual({
      data: [{
        id: 'offer-1',
        name: '虚构候选人甲',
        personalEmail: 'candidate@example.test',
        mobile: '13900000001',
        gender: null,
        organizationName: null,
        appliedPositionName: null,
        offeredPositionName: null,
        workplaceName: null,
        proposedEntryDate: '2026-09-03',
        probationMonths: 3,
        offerSenderName: null,
        issueDate: null,
        recommenderName: null,
        acceptedAt: null,
        syncStatus: null,
        rejectedAt: null,
        rejectedReason: null,
        entryDate: null,
        approvalStatus: null,
        currentApproverName: null,
        offerStatus: ProcessStatus.DRAFT,
        resumeInfo: null,
      }],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1, viewCounts: {
        pendingSend: 1, sent: 1, accepted: 1, rejected: 1, onboarded: 1, all: 1,
      } },
    });
    expect(prisma.offer.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: expect.arrayContaining([{ archivedAt: null }]) } }));
    expect(prisma.fileAttachment.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['attachment-1'] }, status: RecordStatus.ACTIVE, archivedAt: null },
      select: { id: true },
    });
  });

  it('filters an ADMIN without all employee-data permission by accessible Offer organizations', async () => {
    const { service, prisma, access } = createService(false);
    const adminWithoutAll = { ...user, role: 'ADMIN' as const, permissions: [] };

    await service.findOffers(adminWithoutAll, { page: 1, pageSize: 10 });

    expect(access.hasAllEmployeeData).toHaveBeenCalledWith(adminWithoutAll);
    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledWith(adminWithoutAll);
    expect(prisma.offer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ archivedAt: null, organizationId: { in: ['org-a', 'org-child'] } }]),
      }),
    }));
    expect(prisma.offer.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.any(Array) }),
    }));
  });

  it('filters each Offer view with mutually exclusive lifecycle precedence and scoped live counts', async () => {
    const { service, prisma } = createService(false);

    for (const view of ['PENDING_SEND', 'SENT', 'ACCEPTED', 'REJECTED', 'ONBOARDED'] as const) {
      prisma.offer.findMany.mockClear();
      await service.findOffers(user, { view, page: 1, pageSize: 10 });
      const where = prisma.offer.findMany.mock.calls[0][0].where;
      expect(where).toEqual(expect.objectContaining({
        AND: expect.arrayContaining([{ archivedAt: null, organizationId: { in: ['org-a', 'org-child'] } }]),
      }));
    }

    prisma.offer.findMany.mockClear();
    await service.findOffers(user, { view: 'ALL', page: 1, pageSize: 10 });
    const allWhere = prisma.offer.findMany.mock.calls[0][0].where;
    expect(allWhere).toEqual({ archivedAt: null, organizationId: { in: ['org-a', 'org-child'] } });

    prisma.offer.findMany.mockClear();
    await service.findOffers(user, { view: 'SENT', page: 1, pageSize: 10 });
    expect(prisma.offer.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({
      AND: expect.arrayContaining([{ acceptedAt: null }, { issueDate: { not: null } }]),
    }));

    prisma.offer.findMany.mockClear();
    await service.findOffers(user, { view: 'ACCEPTED', page: 1, pageSize: 10 });
    expect(prisma.offer.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({
      AND: expect.arrayContaining([{ acceptedAt: { not: null } }, { status: { not: ProcessStatus.REJECTED } }]),
    }));

    prisma.offer.findMany.mockClear();
    await service.findOffers(user, { view: 'REJECTED', page: 1, pageSize: 10 });
    expect(prisma.offer.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({
      AND: expect.arrayContaining([{ status: ProcessStatus.REJECTED }]),
    }));

    prisma.offer.findMany.mockClear();
    await service.findOffers(user, { view: 'ONBOARDED', page: 1, pageSize: 10 });
    expect(prisma.offer.findMany.mock.calls[0][0].where).toEqual({
      AND: [
        { archivedAt: null, organizationId: { in: ['org-a', 'org-child'] } },
        { onboardingCase: { is: { actualEntryDate: { not: null } } } },
      ],
    });
    expect(prisma.offer.count).toHaveBeenCalledTimes(70);
  });

  it('scopes entries by planned Offer organization and excludes entries without an Offer or department', async () => {
    const { service, prisma, access } = createService(false);
    prisma.onboardingCase.findMany.mockResolvedValue([]);
    prisma.onboardingCase.count.mockResolvedValue(0);

    await service.findEntries(user, query);

    expect(access.hasAllEmployeeData).toHaveBeenCalledWith(user);
    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledWith(user);
    expect(prisma.onboardingCase.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { archivedAt: null, offer: { is: { organizationId: { in: ['org-a', 'org-child'] } } } },
    }));
    expect(prisma.onboardingCase.count).toHaveBeenCalledWith({
      where: { archivedAt: null, offer: { is: { organizationId: { in: ['org-a', 'org-child'] } } } },
    });

    access.hasAllEmployeeData.mockReturnValue(true);
    await service.findEntries({ ...user, permissions: [PERMISSIONS.EMPLOYEE_DATA_ALL] }, query);
    expect(prisma.onboardingCase.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { archivedAt: null },
    }));
    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledTimes(1);
  });

  it('maps planned fields from Offer and candidate source, not legacy employee assignments', async () => {
    const { service, prisma } = createService(false);
    prisma.onboardingCase.findMany.mockResolvedValue([{
      id: 'case-1',
      status: 'PENDING',
      plannedEntryDate: new Date('2026-09-03T00:00:00.000Z'),
      employee: {
        name: '虚构员工甲',
        gender: 'FEMALE',
        reportingAsEmployee: [],
        employmentPeriods: [],
        agreements: [],
      },
      offer: {
        organization: { name: '虚构待入职中心' },
        workplaceName: '虚构园区',
        position: { name: '虚构岗位' },
        candidate: { source: '虚构招聘渠道' },
      },
    }]);
    prisma.onboardingCase.count.mockResolvedValue(1);

    await expect(service.findEntries(user, { page: 1, pageSize: 10 })).resolves.toMatchObject({
      data: [{
        id: 'case-1',
        name: '虚构员工甲',
        gender: 'FEMALE',
        plannedOrganizationName: '虚构待入职中心',
        plannedEntryDate: '2026-09-03',
        plannedWorkplaceName: '虚构园区',
        positionName: '虚构岗位',
        dataSource: '虚构招聘渠道',
      }],
    });
    expect(prisma.onboardingCase.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ offer: expect.any(Object) }),
    }));
  });

  it('uses only a current primary reporting relationship and does not fall back to another manager', async () => {
    const { service, prisma } = createService(false);
    prisma.onboardingCase.findMany.mockResolvedValue([{
      id: 'case-manager',
      status: 'IN_PROGRESS',
      plannedEntryDate: new Date('2026-09-04T00:00:00.000Z'),
      employee: {
        name: '虚构员工乙',
        gender: null,
        reportingAsEmployee: [{ manager: { name: '虚构主要经理' } }],
        employmentPeriods: [],
        agreements: [],
      },
      offer: null,
    }]);
    prisma.onboardingCase.count.mockResolvedValue(1);

    const result = await service.findEntries(user, { page: 1, pageSize: 10 });
    expect(result.data[0]).toMatchObject({ managerName: '虚构主要经理' });

    prisma.onboardingCase.findMany.mockResolvedValue([{
      id: 'case-no-primary',
      status: 'IN_PROGRESS',
      plannedEntryDate: new Date('2026-09-04T00:00:00.000Z'),
      employee: {
        name: '虚构员工丙',
        gender: null,
        reportingAsEmployee: [],
        employmentPeriods: [],
        agreements: [],
      },
      offer: null,
    }]);
    const noPrimary = await service.findEntries(user, { page: 1, pageSize: 10 });
    expect(noPrimary.data[0]).toMatchObject({ managerName: null });
    const entryFind = prisma.onboardingCase.findMany.mock.calls.at(-1)?.[0];
    expect(entryFind.select.employee.select.reportingAsEmployee).toMatchObject({
      where: expect.objectContaining({ status: RecordStatus.ACTIVE, archivedAt: null, isPrimary: true }),
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      take: 1,
    });
  });

  it('keeps task, entry type, job level, employment relationship, and approver fields null', async () => {
    const { service, prisma } = createService(false);
    prisma.onboardingCase.findMany.mockResolvedValue([{
      id: 'case-null-fields',
      status: 'DRAFT',
      plannedEntryDate: new Date('2026-09-05T00:00:00.000Z'),
      employee: { name: '虚构员工丁', gender: null, reportingAsEmployee: [], employmentPeriods: [], agreements: [] },
      offer: { organization: null, workplaceName: null, position: null, candidate: { source: null } },
    }]);
    prisma.onboardingCase.count.mockResolvedValue(1);

    const result = await service.findEntries(user, { page: 1, pageSize: 10 });
    expect(result.data[0]).toMatchObject({
      entryType: null,
      preparationStatus: null,
      informationCollectionStatus: null,
      materialStatus: null,
      jobLevel: null,
      employmentRelationship: null,
      currentApproverName: null,
    });
  });

  it('maps contract data only for one current agreement even when other-period agreements sort first', async () => {
    const { service, prisma } = createService(false);
    const currentAgreement = {
      id: 'agreement-current',
      employmentPeriodId: 'period-current',
      agreementType: 'LABOR_CONTRACT',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2028-01-01T00:00:00.000Z'),
      terminationDate: new Date('2027-09-01T00:00:00.000Z'),
      employingCompany: { name: '虚构全日制公司' },
    };
    const otherPeriodAgreements = [
      {
        ...currentAgreement,
        id: 'agreement-other-newest',
        employmentPeriodId: 'period-old-a',
        startDate: new Date('2026-03-01T00:00:00.000Z'),
      },
      {
        ...currentAgreement,
        id: 'agreement-other-second',
        employmentPeriodId: 'period-old-b',
        startDate: new Date('2026-02-01T00:00:00.000Z'),
      },
    ];
    const base = {
      id: 'case-contract',
      status: 'APPROVED',
      plannedEntryDate: new Date('2026-09-06T00:00:00.000Z'),
      employee: {
        name: '虚构员工戊',
        gender: null,
        reportingAsEmployee: [],
        employmentPeriods: [{ id: 'period-current' }],
        agreements: [...otherPeriodAgreements, currentAgreement],
      },
      offer: null,
    };
    prisma.onboardingCase.findMany.mockResolvedValue([base]);
    prisma.onboardingCase.count.mockResolvedValue(1);

    const result = await service.findEntries(user, { page: 1, pageSize: 10 });
    expect(result.data[0]).toMatchObject({
      fullTimeCompany: '虚构全日制公司',
      contractType: 'LABOR_CONTRACT',
      effectiveDate: '2026-01-01',
      terminationDate: '2027-09-01',
    });
    const agreementQuery = prisma.onboardingCase.findMany.mock.calls.at(-1)?.[0].select.employee.select.agreements;
    expect(agreementQuery).toMatchObject({
      where: expect.objectContaining({
        status: AgreementStatus.ACTIVE,
        archivedAt: null,
        AND: expect.arrayContaining([
          { OR: [{ terminationDate: null }, { terminationDate: { gt: expect.any(Date) } }] },
        ]),
      }),
    });
    expect(agreementQuery).not.toHaveProperty('take');

    prisma.onboardingCase.findMany.mockResolvedValue([{
      ...base,
      employee: {
        ...base.employee,
        agreements: [{ ...currentAgreement, employmentPeriodId: 'period-old', terminationDate: null }],
      },
    }]);
    const unrelated = await service.findEntries(user, { page: 1, pageSize: 10 });
    expect(unrelated.data[0]).toMatchObject({ fullTimeCompany: null, contractType: null, effectiveDate: null, terminationDate: null });

    prisma.onboardingCase.findMany.mockResolvedValue([{
      ...base,
      employee: {
        ...base.employee,
        agreements: [...otherPeriodAgreements, currentAgreement, { ...currentAgreement, id: 'agreement-second' }],
      },
    }]);
    const multiple = await service.findEntries(user, { page: 1, pageSize: 10 });
    expect(multiple.data[0]).toMatchObject({ fullTimeCompany: null, contractType: null, effectiveDate: null, terminationDate: null });
  });

  it('formats dates, preserves pagination ordering, and counts in one transaction', async () => {
    const { service, prisma } = createService(false);
    prisma.onboardingCase.findMany.mockResolvedValue([]);
    prisma.onboardingCase.count.mockResolvedValue(23);

    await service.findEntries(user, { page: 2, pageSize: 10 });

    expect(prisma.onboardingCase.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: 10,
      take: 10,
    }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('scopes integration records through current assignments in accessible organizations without using the legacy department', async () => {
    const { service, prisma, access } = createService(false);

    await service.findIntegration(user, query);

    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledWith(user);
    const findArgs = prisma.onboardingIntegrationRecord.findMany.mock.calls[0][0];
    const countArgs = prisma.onboardingIntegrationRecord.count.mock.calls[0][0];
    expect(findArgs.where).toEqual({
      archivedAt: null,
      employee: {
        assignments: {
          some: {
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            startDate: { lte: expect.any(Date) },
            OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
            organizationId: { in: ['org-a', 'org-child'] },
          },
        },
      },
    });
    expect(findArgs.where.employee).not.toHaveProperty('organizationId');
    expect(countArgs.where).toEqual(findArgs.where);

    access.hasAllEmployeeData.mockReturnValue(true);
    await service.findIntegration({ ...user, permissions: [PERMISSIONS.EMPLOYEE_DATA_ALL] }, query);
    expect(prisma.onboardingIntegrationRecord.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { archivedAt: null },
    }));
    expect(prisma.onboardingIntegrationRecord.count).toHaveBeenLastCalledWith({ where: { archivedAt: null } });
    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledTimes(1);
  });

  it('selects only a current primary assignment and filters its displayed organization for scoped users', async () => {
    const { service, prisma } = createService(false);

    await service.findIntegration(user, query);

    const scopedAssignments = prisma.onboardingIntegrationRecord.findMany.mock.calls[0][0]
      .select.employee.select.assignments;
    expect(scopedAssignments).toEqual({
      where: {
        status: AssignmentStatus.ACTIVE,
        archivedAt: null,
        startDate: { lte: expect.any(Date) },
        OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
        organizationId: { in: ['org-a', 'org-child'] },
        isPrimary: true,
      },
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      take: 1,
      select: {
        organization: { select: { name: true } },
        jobTitle: { select: { name: true } },
      },
    });
    expect(scopedAssignments.select).not.toHaveProperty('position');

    const admin = { ...user, role: 'ADMIN' as const, permissions: [] };
    const adminService = createService(false);
    await adminService.service.findIntegration(admin, query);
    const adminAssignments = adminService.prisma.onboardingIntegrationRecord.findMany.mock.calls[0][0]
      .select.employee.select.assignments;
    expect(adminAssignments).toMatchObject({
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      take: 1,
    });
    expect(adminAssignments.where).toEqual({
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: expect.any(Date) },
      OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
      organizationId: { in: ['org-a', 'org-child'] },
      isPrimary: true,
    });
    expect(adminService.prisma.onboardingIntegrationRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        archivedAt: null,
        employee: { assignments: { some: expect.objectContaining({ organizationId: { in: ['org-a', 'org-child'] } }) } },
      },
    }));
    expect(adminService.access.getAccessibleOrganizationIds).toHaveBeenCalledWith(admin);
    expect(adminService.access.getAccessibleOrganizationIds).toHaveBeenCalledTimes(1);
  });

  it('maps integration details from current primary HR records and keeps progress null', async () => {
    const { service, prisma } = createService(false);
    prisma.onboardingIntegrationRecord.findMany.mockResolvedValue([{
      id: 'integration-1',
      status: 'IN_PROGRESS',
      employee: {
        name: '虚构员工己',
        assignments: [{
          organization: { name: '虚构产品中心' },
          jobTitle: { name: '虚构产品职务' },
        }],
        employmentPeriods: [{ entryDate: new Date('2026-08-07T00:00:00.000Z') }],
        reportingAsEmployee: [{ manager: { name: '虚构直线经理' } }],
      },
    }]);
    prisma.onboardingIntegrationRecord.count.mockResolvedValue(1);

    await expect(service.findIntegration(user, { page: 1, pageSize: 10 })).resolves.toEqual({
      data: [{
        id: 'integration-1',
        employeeName: '虚构员工己',
        organizationName: '虚构产品中心',
        jobTitleName: '虚构产品职务',
        entryDate: '2026-08-07',
        managerName: '虚构直线经理',
        integrationStatus: 'IN_PROGRESS',
        integrationProgress: null,
      }],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    const employeeSelect = prisma.onboardingIntegrationRecord.findMany.mock.calls[0][0].select.employee.select;
    expect(employeeSelect.employmentPeriods).toMatchObject({
      where: {
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
        actualExitDate: null,
      },
      orderBy: [{ sequenceNo: 'desc' }],
      take: 1,
      select: { entryDate: true },
    });
    expect(employeeSelect.reportingAsEmployee).toMatchObject({
      where: expect.objectContaining({
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        isPrimary: true,
        startDate: { lte: expect.any(Date) },
      }),
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      take: 1,
      select: { manager: { select: { name: true } } },
    });
  });

  it('returns null organization and job title when there is no displayable primary assignment', async () => {
    const { service, prisma } = createService(false);
    prisma.onboardingIntegrationRecord.findMany.mockResolvedValue([{
      id: 'integration-no-primary',
      status: 'PENDING',
      employee: {
        name: '虚构员工庚',
        assignments: [],
        employmentPeriods: [],
        reportingAsEmployee: [],
      },
    }]);
    prisma.onboardingIntegrationRecord.count.mockResolvedValue(1);

    const result = await service.findIntegration(user, { page: 1, pageSize: 10 });

    expect(result.data[0]).toEqual({
      id: 'integration-no-primary',
      employeeName: '虚构员工庚',
      organizationName: null,
      jobTitleName: null,
      entryDate: null,
      managerName: null,
      integrationStatus: 'PENDING',
      integrationProgress: null,
    });
  });

  it('paginates integration records with stable ordering and one find/count transaction', async () => {
    const { service, prisma } = createService(false);
    prisma.onboardingIntegrationRecord.count.mockResolvedValue(41);

    await service.findIntegration(user, { page: 2, pageSize: 20 });

    expect(prisma.onboardingIntegrationRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: 20,
      take: 20,
    }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('scopes introduction records through current authorized assignments unless employee.data.all is granted', async () => {
    const { service, prisma, access } = createService(false);

    await service.findIntroduction(user, query);

    const scopedWhere = prisma.employeeIntroduction.findMany.mock.calls[0][0].where;
    expect(scopedWhere).toEqual({
      archivedAt: null,
      employee: {
        assignments: {
          some: {
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            startDate: { lte: expect.any(Date) },
            OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
            organizationId: { in: ['org-a', 'org-child'] },
          },
        },
      },
    });
    expect(scopedWhere.employee).not.toHaveProperty('organizationId');
    expect(prisma.employeeIntroduction.count).toHaveBeenCalledWith({ where: scopedWhere });

    const adminWithoutAll = { ...user, role: 'ADMIN' as const, permissions: [] };
    const adminService = createService(false);
    await adminService.service.findIntroduction(adminWithoutAll, query);
    expect(adminService.access.getAccessibleOrganizationIds).toHaveBeenCalledWith(adminWithoutAll);
    expect(adminService.prisma.employeeIntroduction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        archivedAt: null,
        employee: {
          assignments: {
            some: expect.objectContaining({ organizationId: { in: ['org-a', 'org-child'] } }),
          },
        },
      },
    }));

    access.hasAllEmployeeData.mockReturnValue(true);
    const allDataUser = { ...user, permissions: [PERMISSIONS.EMPLOYEE_DATA_ALL] };
    await service.findIntroduction(allDataUser, query);
    expect(prisma.employeeIntroduction.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { archivedAt: null },
    }));
    expect(prisma.employeeIntroduction.count).toHaveBeenLastCalledWith({ where: { archivedAt: null } });
    expect(prisma.employeeIntroduction.findMany.mock.calls.at(-1)?.[0].select.employee.select.assignments.where).toEqual({
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: expect.any(Date) },
      OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
      isPrimary: true,
    });
    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledTimes(1);
  });

  it('selects only current primary authorized assignments for introduction display and uses position instead of job title', async () => {
    const { service, prisma } = createService(false);

    await service.findIntroduction(user, query);

    const select = prisma.employeeIntroduction.findMany.mock.calls[0][0].select;
    expect(select).toEqual({
      id: true,
      status: true,
      employee: {
        select: {
          name: true,
          gender: true,
          assignments: {
            where: {
              status: AssignmentStatus.ACTIVE,
              archivedAt: null,
              startDate: { lte: expect.any(Date) },
              OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
              organizationId: { in: ['org-a', 'org-child'] },
              isPrimary: true,
            },
            orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
            take: 1,
            select: {
              organization: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
          employmentPeriods: {
            where: {
              status: RecordStatus.ACTIVE,
              archivedAt: null,
              employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
              actualExitDate: null,
            },
            orderBy: [{ sequenceNo: 'desc' }],
            take: 1,
            select: { entryDate: true },
          },
        },
      },
    });
    expect(select).not.toHaveProperty('title');
    expect(select).not.toHaveProperty('content');
    expect(select).not.toHaveProperty('publishedAt');
    expect(select.employee.select.assignments.select).not.toHaveProperty('jobTitle');
  });

  it('maps introduction rows independently from current HR records and returns null for missing relations', async () => {
    const { service, prisma } = createService(false);
    const employeeWithRelations = {
      name: '虚构员工辛',
      gender: 'FEMALE',
      assignments: [{
        organization: { name: '虚构客户中心' },
        position: { name: '虚构顾问岗位' },
      }],
      employmentPeriods: [{ entryDate: new Date('2026-08-11T00:00:00.000Z') }],
    };
    prisma.employeeIntroduction.findMany.mockResolvedValue([
      { id: 'introduction-1', status: 'PUBLISHED', employee: employeeWithRelations },
      { id: 'introduction-2', status: 'DRAFT', employee: employeeWithRelations },
      {
        id: 'introduction-3',
        status: 'PENDING',
        employee: {
          name: '虚构员工壬',
          gender: null,
          assignments: [],
          employmentPeriods: [],
        },
      },
    ]);
    prisma.employeeIntroduction.count.mockResolvedValue(3);

    const result = await service.findIntroduction(user, { page: 1, pageSize: 10 });

    expect(result).toEqual({
      data: [
        {
          id: 'introduction-1',
          name: '虚构员工辛',
          gender: 'FEMALE',
          organizationName: '虚构客户中心',
          positionName: '虚构顾问岗位',
          entryDate: '2026-08-11',
          introductionStatus: 'PUBLISHED',
        },
        {
          id: 'introduction-2',
          name: '虚构员工辛',
          gender: 'FEMALE',
          organizationName: '虚构客户中心',
          positionName: '虚构顾问岗位',
          entryDate: '2026-08-11',
          introductionStatus: 'DRAFT',
        },
        {
          id: 'introduction-3',
          name: '虚构员工壬',
          gender: null,
          organizationName: null,
          positionName: null,
          entryDate: null,
          introductionStatus: 'PENDING',
        },
      ],
      meta: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
    });
    expect(result.data).toHaveLength(3);
    expect(result.data[0].name).toBe(result.data[1].name);
    for (const row of result.data) {
      expect(row).not.toHaveProperty('title');
      expect(row).not.toHaveProperty('content');
      expect(row).not.toHaveProperty('publishedAt');
    }
  });

  it('paginates introduction records with stable ordering and one consistent find/count transaction', async () => {
    const { service, prisma } = createService(false);
    prisma.employeeIntroduction.count.mockResolvedValue(41);

    const result = await service.findIntroduction(user, { page: 2, pageSize: 20 });

    const findArgs = prisma.employeeIntroduction.findMany.mock.calls[0][0];
    expect(findArgs).toMatchObject({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: 20,
      take: 20,
    });
    expect(prisma.employeeIntroduction.count).toHaveBeenCalledWith({ where: findArgs.where });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.meta).toEqual({ page: 2, pageSize: 20, total: 41, totalPages: 3 });
  });

  it('queries only active unarchived national ID documents with current authorized assignments', async () => {
    const { service, prisma, access } = createService(false);
    await service.findIdCardReader(user, query);

    const findArgs = prisma.employeeIdentityDocument.findMany.mock.calls[0][0];
    expect(findArgs.where).toEqual({
      documentType: 'NATIONAL_ID',
      status: RecordStatus.ACTIVE,
      archivedAt: null,
      employee: {
        assignments: {
          some: {
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            startDate: { lte: expect.any(Date) },
            OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
            organizationId: { in: ['org-a', 'org-child'] },
          },
        },
      },
    });
    expect(findArgs.where.employee).not.toHaveProperty('organizationId');
    expect(prisma.employeeIdentityDocument.count).toHaveBeenCalledWith({ where: findArgs.where });
    expect(findArgs.select.employee.select.terminationRecords.where).toEqual({
      status: { in: [ProcessStatus.APPROVED, ProcessStatus.IN_PROGRESS, ProcessStatus.COMPLETED] },
      archivedAt: null,
    });
    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledWith(user);

    const adminWithoutAll = { ...user, role: 'ADMIN' as const, permissions: [] };
    const adminService = createService(false);
    await adminService.service.findIdCardReader(adminWithoutAll, query);
    expect(adminService.prisma.employeeIdentityDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ employee: { assignments: { some: expect.objectContaining({ organizationId: { in: ['org-a', 'org-child'] } }) } } }),
    }));
    expect(adminService.access.getAccessibleOrganizationIds).toHaveBeenCalledWith(adminWithoutAll);

    adminService.access.hasAllEmployeeData.mockReturnValue(true);
    await adminService.service.findIdCardReader({ ...adminWithoutAll, permissions: [PERMISSIONS.EMPLOYEE_DATA_ALL] }, query);
    expect(adminService.prisma.employeeIdentityDocument.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { documentType: 'NATIONAL_ID', status: RecordStatus.ACTIVE, archivedAt: null },
    }));
    expect(adminService.access.getAccessibleOrganizationIds).toHaveBeenCalledTimes(1);
  });

  it('maps dates, employee fields, and fixed placeholders in the API', async () => {
    const { service, prisma } = createService(false);
    const createdAt = new Date('2026-08-20T12:34:56.000Z');
    prisma.employeeIdentityDocument.findMany.mockResolvedValue([{
      id: 'identity-1',
      documentType: 'NATIONAL_ID',
      documentNumber: '110101199002031021',
      issuingAuthority: '虚构市公安局',
      issueDate: new Date('2010-02-03T00:00:00.000Z'),
      expiryDate: new Date('2030-02-03T00:00:00.000Z'),
      createdAt,
      employee: {
        name: '虚构员工甲',
        gender: 'FEMALE',
        ethnicity: '虚构民族',
        birthDate: new Date('1990-02-03T00:00:00.000Z'),
        householdAddress: '虚构省虚构市虚构路1号',
        terminationRecords: [],
      },
    }]);

    await expect(service.findIdCardReader(user, { page: 1, pageSize: 10 })).resolves.toMatchObject({
      data: [{
        name: '虚构员工甲',
        gender: 'FEMALE',
        ethnicity: '虚构民族',
        birthDate: '1990-02-03',
        householdAddress: '虚构省虚构市虚构路1号',
        documentType: 'NATIONAL_ID',
        documentNumber: '110101199002031021',
        issuingAuthority: '虚构市公安局',
        issueDate: '2010-02-03',
        expiryDate: '2030-02-03',
        lastWorkingDate: null,
        previousOrganizationName: null,
        terminationType: null,
        terminationReason: null,
        photo: null,
        recordedBy: null,
        recordedAt: '2026-08-20T12:34:56.000Z',
      }],
    });

    const employeeSelect = prisma.employeeIdentityDocument.findMany.mock.calls[0][0].select.employee.select;
    expect(employeeSelect).toHaveProperty('householdAddress', true);
    expect(employeeSelect.terminationRecords.select).toHaveProperty('reason', true);
  });

  it('selects one deterministic termination context and only its matching period assignment', async () => {
    const { service, prisma } = createService(false);
    prisma.employeeIdentityDocument.findMany.mockResolvedValue([{
      id: 'identity-termination',
      documentType: 'NATIONAL_ID',
      documentNumber: '虚构证件编号-001',
      issuingAuthority: null,
      issueDate: null,
      expiryDate: null,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
      employee: {
        name: '虚构员工乙',
        gender: null,
        ethnicity: null,
        birthDate: null,
        householdAddress: null,
        terminationRecords: [
          {
            id: 'termination-old',
            employmentPeriodId: 'period-old',
            actualLastWorkingDate: new Date('2026-05-01T00:00:00.000Z'),
            plannedLastWorkingDate: new Date('2026-05-02T00:00:00.000Z'),
            terminationType: '虚构旧类型',
            reason: '虚构旧原因',
            createdAt: new Date('2026-05-03T00:00:00.000Z'),
            employmentPeriod: { assignments: [{
              id: 'assignment-old', isPrimary: true, status: AssignmentStatus.ACTIVE, archivedAt: null,
              startDate: new Date('2026-01-01T00:00:00.000Z'), endDate: null,
              organization: { name: '虚构旧部门' },
            }] },
          },
          {
            id: 'termination-new',
            employmentPeriodId: 'period-new',
            actualLastWorkingDate: new Date('2026-07-31T00:00:00.000Z'),
            plannedLastWorkingDate: new Date('2026-08-01T00:00:00.000Z'),
            terminationType: '虚构新类型',
            reason: '虚构新原因',
            createdAt: new Date('2026-07-20T00:00:00.000Z'),
            employmentPeriod: { assignments: [
              {
                id: 'assignment-wrong-period', isPrimary: true, status: AssignmentStatus.ACTIVE, archivedAt: null,
                startDate: new Date('2026-01-01T00:00:00.000Z'), endDate: null,
                organization: { name: '虚构错误部门' },
              },
              {
                id: 'assignment-not-effective', isPrimary: true, status: AssignmentStatus.ACTIVE, archivedAt: null,
                startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: null,
                organization: { name: '虚构未来部门' },
              },
              {
                id: 'assignment-primary', isPrimary: true, status: AssignmentStatus.ACTIVE, archivedAt: null,
                startDate: new Date('2026-07-01T00:00:00.000Z'), endDate: new Date('2026-07-31T00:00:00.000Z'),
                organization: { id: 'org-a', name: '虚构离职前部门' },
              },
              {
                id: 'assignment-secondary', isPrimary: false, status: AssignmentStatus.ACTIVE, archivedAt: null,
                startDate: new Date('2026-07-15T00:00:00.000Z'), endDate: null,
                organization: { name: '虚构其他部门' },
              },
            ] },
          },
        ],
      },
    }]);

    const result = await service.findIdCardReader({ ...user, permissions: [PERMISSIONS.EMPLOYEE_READ] }, { page: 1, pageSize: 10 });
    expect(result.data[0]).toMatchObject({
      lastWorkingDate: '2026-07-31',
      previousOrganizationName: '虚构离职前部门',
      terminationType: '虚构新类型',
      terminationReason: '虚构新原因',
    });
  });

  it('does not fall back from a null actual date or infer a department without a matching period', async () => {
    const { service, prisma } = createService(false);
    prisma.employeeIdentityDocument.findMany.mockResolvedValue([{
      id: 'identity-no-actual', documentType: 'NATIONAL_ID', documentNumber: '虚构证件编号-002',
      issuingAuthority: null, issueDate: null, expiryDate: null, createdAt: new Date('2026-08-20T00:00:00.000Z'),
      employee: {
        name: '虚构员工丙', gender: null, ethnicity: null, birthDate: null, householdAddress: null,
        terminationRecords: [{
          id: 'termination-no-actual', employmentPeriodId: null,
          actualLastWorkingDate: null, plannedLastWorkingDate: new Date('2026-08-10T00:00:00.000Z'),
          terminationType: '虚构计划类型', reason: '虚构计划原因', createdAt: new Date('2026-08-01T00:00:00.000Z'),
          employmentPeriod: null,
        }],
      },
    }]);
    const result = await service.findIdCardReader({ ...user, permissions: [PERMISSIONS.EMPLOYEE_READ] }, { page: 1, pageSize: 10 });
    expect(result.data[0]).toMatchObject({
      lastWorkingDate: null,
      previousOrganizationName: null,
      terminationType: '虚构计划类型',
      terminationReason: '虚构计划原因',
    });

    prisma.employeeIdentityDocument.findMany.mockResolvedValue([{
      id: 'identity-no-matching-assignment', documentType: 'NATIONAL_ID', documentNumber: '虚构证件编号-003',
      issuingAuthority: null, issueDate: null, expiryDate: null, createdAt: new Date('2026-08-19T00:00:00.000Z'),
      employee: {
        name: '虚构员工丁', gender: null, ethnicity: null, birthDate: null, householdAddress: null,
        terminationRecords: [{
          id: 'termination-no-matching-assignment', employmentPeriodId: 'period-no-match',
          actualLastWorkingDate: new Date('2026-08-10T00:00:00.000Z'),
          plannedLastWorkingDate: new Date('2026-08-11T00:00:00.000Z'),
          terminationType: '虚构无匹配类型', reason: '虚构无匹配原因', createdAt: new Date('2026-08-01T00:00:00.000Z'),
          employmentPeriod: { assignments: [{
            id: 'assignment-starts-later', isPrimary: true, status: AssignmentStatus.ACTIVE, archivedAt: null,
            startDate: new Date('2026-08-11T00:00:00.000Z'), endDate: null,
            organization: { name: '虚构不匹配部门' },
          }] },
        }],
      },
    }]);
    const unmatched = await service.findIdCardReader({ ...user, permissions: [PERMISSIONS.EMPLOYEE_READ] }, { page: 1, pageSize: 10 });
    expect(unmatched.data[0]).toMatchObject({
      lastWorkingDate: '2026-08-10',
      previousOrganizationName: null,
      terminationType: '虚构无匹配类型',
      terminationReason: '虚构无匹配原因',
    });

    const findArgs = prisma.employeeIdentityDocument.findMany.mock.calls[0][0];
    expect(findArgs.select.employee.select.terminationRecords.select).not.toHaveProperty('employee');
    expect(findArgs.select.employee.select).not.toHaveProperty('profilePhoto');
    expect(findArgs.select).not.toHaveProperty('frontAttachment');
    expect(findArgs.select).not.toHaveProperty('backAttachment');
  });

  it('keeps the latest valid completed termination record when newer drafts are present', async () => {
    const { service, prisma } = createService(false);
    const completed = {
      id: 'termination-completed',
      status: ProcessStatus.COMPLETED,
      employmentPeriodId: null,
      actualLastWorkingDate: new Date('2026-05-01T00:00:00.000Z'),
      plannedLastWorkingDate: new Date('2026-05-02T00:00:00.000Z'),
      terminationType: '虚构已完成类型',
      reason: '虚构已完成原因',
      createdAt: new Date('2026-05-03T00:00:00.000Z'),
      employmentPeriod: null,
    };
    const newerDraft = { ...completed, id: 'termination-draft', status: ProcessStatus.DRAFT, actualLastWorkingDate: new Date('2026-08-01T00:00:00.000Z'), reason: '虚构草稿原因' };
    const newerCancelled = { ...completed, id: 'termination-cancelled', status: ProcessStatus.CANCELLED, actualLastWorkingDate: new Date('2026-09-01T00:00:00.000Z'), reason: '虚构取消原因' };
    const records = [completed, newerDraft, newerCancelled];
    prisma.employeeIdentityDocument.findMany.mockImplementation(async (args) => [{
      id: 'identity-status',
      documentType: 'NATIONAL_ID',
      documentNumber: '虚构证件编号-004',
      issuingAuthority: null,
      issueDate: null,
      expiryDate: null,
      createdAt: new Date('2026-09-02T00:00:00.000Z'),
      employee: {
        name: '虚构员工戊',
        gender: null,
        ethnicity: null,
        birthDate: null,
        terminationRecords: args.select.employee.select.terminationRecords.where.status.in
          .includes(ProcessStatus.COMPLETED) ? records.filter(({ status }) => args.select.employee.select.terminationRecords.where.status.in.includes(status)) : records,
      },
    }]);

    const result = await service.findIdCardReader({ ...user, permissions: [PERMISSIONS.EMPLOYEE_READ] }, { page: 1, pageSize: 10 });

    expect(result.data[0]).toMatchObject({
      lastWorkingDate: '2026-05-01',
      terminationType: '虚构已完成类型',
      terminationReason: '虚构已完成原因',
    });
    const terminationWhere = prisma.employeeIdentityDocument.findMany.mock.calls[0][0].select.employee.select.terminationRecords.where;
    expect(terminationWhere).toEqual({
      status: { in: [ProcessStatus.APPROVED, ProcessStatus.IN_PROGRESS, ProcessStatus.COMPLETED] },
      archivedAt: null,
    });
  });

  it('paginates and sorts identity documents with one consistent find/count transaction', async () => {
    const { service, prisma } = createService(false);
    prisma.employeeIdentityDocument.count.mockResolvedValue(21);
    const result = await service.findIdCardReader(user, { page: 2, pageSize: 10 });
    const findArgs = prisma.employeeIdentityDocument.findMany.mock.calls[0][0];
    expect(findArgs).toMatchObject({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: 10, take: 10 });
    expect(prisma.employeeIdentityDocument.count).toHaveBeenCalledWith({ where: findArgs.where });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.meta).toEqual({ page: 2, pageSize: 10, total: 21, totalPages: 3 });
  });

  it('batch-checks active unarchived resume attachments', async () => {
    const { service, prisma } = createService(false);
    prisma.offer.findMany.mockResolvedValue([
      {
        id: 'offer-1',
        proposedEntryDate: null,
        candidate: { name: '虚构候选人甲', email: 'candidate-a@example.test', resumeAttachmentId: 'attachment-active' },
        acceptedEmployee: { gender: 'UNDISCLOSED' },
        organization: { name: '虚构研发中心' },
        position: { name: '虚构测试岗位' },
      },
      {
        id: 'offer-2',
        proposedEntryDate: new Date('2026-10-01T00:00:00.000Z'),
        candidate: { name: '虚构候选人乙', email: 'candidate-b@example.test', resumeAttachmentId: 'attachment-archived' },
        acceptedEmployee: { gender: 'MALE' },
        organization: { name: '虚构研发中心' },
        position: { name: '虚构测试岗位' },
      },
      {
        id: 'offer-3',
        proposedEntryDate: null,
        candidate: { name: '虚构候选人丙', email: null, resumeAttachmentId: null },
        acceptedEmployee: { gender: null },
        organization: { name: '虚构研发中心' },
        position: { name: '虚构测试岗位' },
      },
    ]);
    prisma.offer.count.mockResolvedValue(3);
    prisma.fileAttachment.findMany.mockResolvedValue([{ id: 'attachment-active' }]);

    await expect(service.findOffers(user, { page: 1, pageSize: 10 }))
      .resolves.toMatchObject({
        data: [
          expect.objectContaining({ personalEmail: 'candidate-a@example.test', resumeInfo: 'AVAILABLE' }),
          expect.objectContaining({ personalEmail: 'candidate-b@example.test', resumeInfo: null }),
          expect.objectContaining({ personalEmail: null, resumeInfo: null }),
        ],
      });
    expect(prisma.fileAttachment.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['attachment-active', 'attachment-archived'] }, status: RecordStatus.ACTIVE, archivedAt: null },
      select: { id: true },
    });
    const candidateSelect = prisma.offer.findMany.mock.calls[0][0].select.candidate.select;
    expect(candidateSelect).toEqual({ name: true, mobile: true, email: true, resumeAttachmentId: true });
  });

});
