import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService } from '../audit/audit.service';
import { DemoDataService } from '../demo/demo-data.service';
import { EmployeesService } from './employees.service';

const auditContext = { userId: 'demo-user-admin' };

function createServices() {
  const config = { get: (_key: string, fallback: unknown) => fallback } as never;
  const demo = new DemoDataService(config);
  const prisma = {} as never;
  const access = new AccessControlService(prisma, demo);
  const audit = new AuditService(prisma, demo);
  const employees = new EmployeesService(prisma, access, audit, demo);
  return { demo, access, employees };
}

function query(overrides: Partial<{ keyword: string; organizationId: string; status: EmploymentStatus; page: number; pageSize: number }> = {}) {
  return { page: 1, pageSize: 10, ...overrides } as never;
}

describe('EmployeesService in demo mode', () => {
  it('filters, paginates, and returns complete rows within the role scope', async () => {
    const { demo, employees } = createServices();
    const departmentAdmin = demo.getUser('demo-user-deptadmin')!;

    const firstPage = await employees.findAll(departmentAdmin, query({ pageSize: 2 }));
    const resigned = await employees.findAll(departmentAdmin, query({ status: EmploymentStatus.RESIGNED }));
    const byKeyword = await employees.findAll(departmentAdmin, query({ keyword: '1002' }));

    expect(firstPage.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(firstPage.data[0]?.mobile).toBe('13800001001');
    expect(resigned.data.map((employee) => employee.employeeNo)).toEqual(['DEMO-2001']);
    expect(byKeyword.data.map((employee) => employee.name)).toEqual(['周予安']);
  });

  it('does not expose departments or employees outside the user scope', async () => {
    const { demo, access, employees } = createServices();
    const viewer = demo.getUser('demo-user-viewer')!;

    const result = await employees.findAll(viewer, query({ organizationId: 'demo-org-ceo_second_tmall_supermarket' }));
    expect(result.data).toEqual([]);
    await expect(
      employees.findOne(viewer, 'demo-employee-1001', auditContext),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      access.assertOrganizationAccess(viewer, 'demo-org-ceo_second_tmall_supermarket'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps complete employee creation unavailable in demo mode', async () => {
    const { demo, employees } = createServices();
    const admin = demo.getUser('demo-user-admin')!;

    await expect(employees.create(admin, {
      employeeNo: 'DEMO-5001',
      name: '完整演示员工',
      workEmail: 'fictional.employee@example.invalid',
      personnelCategory: 'NON_TALENT_PROGRAM',
      employmentRelationship: 'INTERNAL_EMPLOYEE',
      personnelSource: 'SOCIAL_RECRUITMENT',
      workArrangement: 'CONTRACT_EMPLOYMENT',
      mobile: '13800005001',
      documentType: 'NATIONAL_ID',
      documentNumber: '110101199901015001',
      entryDate: '2026-01-01',
      organizationId: 'demo-org-chairman_customer_service',
      hasProbation: false,
      employmentStatus: EmploymentStatus.REGULAR,
    } as never, auditContext)).rejects.toThrow('完整新增人员仅支持数据库模式');
  });

  it('returns complete values without a separate field permission', async () => {
    const { demo, employees } = createServices();
    const user = {
      ...demo.getUser('demo-user-admin')!,
      permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.EMPLOYEE_DATA_ALL],
    };

    const result = await employees.findOne(user, 'demo-employee-1001', auditContext);

    expect(result.mobile).toBe('13800001001');
    expect(result.idCardNo).toBe('110101199203181021');
    expect(result.assignmentId).toBeNull();
    expect(result.documentType).toBe('NATIONAL_ID');
    expect(result.workEmail).toBeNull();
  });
});

describe('EmployeesService database detail authorization', () => {
  it('returns 404 when only an archived in-scope assignment could match', async () => {
    const employeeFindFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      organization: { findMany: jest.fn().mockResolvedValue([{ id: 'org-a', parentId: null }]) },
      employee: { findFirst: employeeFindFirst },
    };
    const demo = { enabled: false };
    const access = new AccessControlService(prisma as never, demo as never);
    const audit = { create: jest.fn() };
    const employees = new EmployeesService(prisma as never, access, audit as never, demo as never);
    const viewer = {
      id: 'user-1', username: 'viewer', displayName: '虚构查看者', role: 'VIEWER' as const,
      roleName: '查看者', permissions: [PERMISSIONS.EMPLOYEE_READ], organizationIds: ['org-a'],
    };

    await expect(employees.findOne(viewer, 'employee-archived-only', auditContext))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(employeeFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'employee-archived-only',
        OR: [
          {
            assignments: {
              some: expect.objectContaining({
                status: 'ACTIVE',
                archivedAt: null,
                organizationId: { in: ['org-a'] },
              }),
            },
          },
          { assignments: { none: {} }, organizationId: { in: ['org-a'] } },
        ],
      },
    }));
    expect(audit.create).not.toHaveBeenCalled();
  });
});

describe('EmployeesService database form options', () => {
  it('returns only directory-backed options and excludes fixed enum directories', async () => {
    const positions = [{ id: 'position-1', code: '00105', name: 'web前端工程师', organizationId: null }];
    const managers = [{ id: 'manager-1', name: '虚构经理', employeeNo: 'FAKE-M001' }];
    const employingCompanies = [{ id: 'company-1', code: 'COMPANY_001', name: '虚构全日制公司' }];
    const prisma = {
      position: { findMany: jest.fn().mockReturnValue(undefined) },
      employee: { findMany: jest.fn().mockReturnValue(undefined) },
      employingCompany: { findMany: jest.fn().mockReturnValue(undefined) },
      $transaction: jest.fn().mockResolvedValue([
        positions,
        managers,
        employingCompanies,
      ]),
    };
    const service = new EmployeesService(
      prisma as never,
      {
        hasAllEmployeeData: jest.fn().mockReturnValue(true),
        getAccessibleOrganizationIds: jest.fn(),
        getEmployeeWhere: jest.fn(),
      } as never,
      { create: jest.fn() } as never,
      { enabled: false } as never,
    );
    const user = {
      id: 'user-admin', username: 'admin', displayName: '虚构管理员', role: 'ADMIN' as const,
      roleName: '管理员', permissions: [PERMISSIONS.EMPLOYEE_CREATE], organizationIds: [],
    };

    const result = await service.getFormOptions(user);

    expect(result).toEqual({
      positions,
      managers,
      employingCompanies,
    });
    expect(result).not.toHaveProperty('signingOrganizations');
    expect(result).not.toHaveProperty('personnelPositions');
    expect(result).not.toHaveProperty('employeeLevels');
    expect(prisma.position.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', archivedAt: null },
      select: { id: true, code: true, name: true, organizationId: true },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    });
  });
});

describe('EmployeesService database department history', () => {
  const employeeId = 'employee-organization-1';
  const user = {
    id: 'user-admin', username: 'admin', displayName: '虚构管理员', role: 'ADMIN' as const,
    roleName: '管理员', permissions: [PERMISSIONS.EMPLOYEE_UPDATE], organizationIds: ['org-current', 'org-target'],
  };
  const currentEmployee = {
    id: employeeId,
    employeeNo: 'FAKE-ORGANIZATION-001',
    name: '虚构组织员工',
    mobile: '13900001008',
    idCardNo: null,
    organizationId: 'org-current',
    organization: { id: 'org-current', name: '旧部门' },
    assignments: [], employmentPeriods: [], reportingAsEmployee: [], identityDocuments: [], familyMembers: [],
    educationExperiences: [], workExperiences: [], convertedCandidates: [], gender: null, workEmail: null,
    personalEmail: null, birthDate: null, ethnicity: null, maritalStatus: null, politicalStatus: null,
    nativePlace: null, nativePlaceRegionCode: null, householdType: null, householdRegionCode: null,
    householdAddress: null, residentialRegionCode: null, residentialAddress: null, bankName: null,
    bankBranchName: null, bankAccountNumber: null, employmentRecords: [{ status: EmploymentStatus.REGULAR }],
    createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const currentAssignment = {
    id: 'assignment-current', employmentPeriodId: 'period-1', positionId: 'position-1', position: { id: 'position-1', code: 'POS-01', name: '原职位' }, jobLevel: 'S2',
    jobTitleId: 'job-title-1', workplaceName: '上海园区一期', assignmentType: 'PRIMARY',
    personnelPosition: 'FRONT_OFFICE', employeeLevel: 'STAFF', personnelCategory: 'NON_TALENT_PROGRAM',
    employmentRelationship: 'INTERNAL_EMPLOYEE', personnelSource: 'SOCIAL_RECRUITMENT',
    workArrangement: 'CONTRACT_EMPLOYMENT', organization: { id: 'org-current', code: 'CURRENT', name: '旧部门' },
    startDate: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('ends the former primary assignment and creates a successor when the department changes', async () => {
    const assignmentUpdate = jest.fn().mockResolvedValue(undefined);
    const assignmentCreate = jest.fn().mockResolvedValue({ id: 'assignment-next' });
    const employeeUpdate = jest.fn().mockResolvedValue(undefined);
    const changeLogCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      employeeAssignment: { findFirst: jest.fn().mockResolvedValue(currentAssignment), update: assignmentUpdate, create: assignmentCreate },
      employeeIdentityDocument: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: { update: employeeUpdate, findUniqueOrThrow: jest.fn().mockResolvedValue(currentEmployee) },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'org-target', code: 'TARGET', name: '新部门' }) },
      employeeFieldChangeLog: { create: changeLogCreate },
    };
    const access = { getEmployeeWhere: jest.fn().mockResolvedValue({}), assertOrganizationAccess: jest.fn().mockResolvedValue(undefined) };
    const service = new EmployeesService(
      { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)), employee: { findFirst: jest.fn().mockResolvedValue(currentEmployee) } } as never,
      access as never,
      { create: jest.fn() } as never,
      { enabled: false } as never,
    );

    await service.update(user, employeeId, { organizationId: 'org-target' } as never, auditContext);

    expect(access.assertOrganizationAccess).toHaveBeenCalledWith(user, 'org-target');
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-target' }) }));
    expect(assignmentUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'assignment-current' },
      data: expect.objectContaining({ status: 'ENDED', endDate: expect.any(Date) }),
    }));
    expect(assignmentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        employeeId,
        organizationId: 'org-target',
        positionId: 'position-1',
        jobLevel: 'S2',
        jobTitleId: 'job-title-1',
        workplaceName: '上海园区一期',
        isPrimary: true,
        status: 'ACTIVE',
      }),
    }));
    expect(changeLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        assignmentId: 'assignment-next',
        changedField: 'organizationId',
        oldValue: { id: 'org-current', code: 'CURRENT', label: '旧部门' },
        newValue: { id: 'org-target', code: 'TARGET', label: '新部门' },
      }),
    }));
  });

  it('updates an existing primary assignment workplace as free text', async () => {
    const assignmentUpdate = jest.fn().mockResolvedValue(undefined);
    const changeLogCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      employeeAssignment: { findFirst: jest.fn().mockResolvedValue(currentAssignment), update: assignmentUpdate },
      employeeIdentityDocument: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: { update: jest.fn().mockResolvedValue(undefined), findUniqueOrThrow: jest.fn().mockResolvedValue(currentEmployee) },
      position: { findUnique: jest.fn() },
      employeeFieldChangeLog: { create: changeLogCreate },
    };
    const service = new EmployeesService(
      { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)), employee: { findFirst: jest.fn().mockResolvedValue(currentEmployee) } } as never,
      { getEmployeeWhere: jest.fn().mockResolvedValue({}) } as never,
      { create: jest.fn() } as never,
      { enabled: false } as never,
    );

    await service.update(user, employeeId, { workplaceName: '上海园区二期' } as never, auditContext);

    expect(assignmentUpdate).toHaveBeenCalledWith({
      where: { id: 'assignment-current' },
      data: expect.objectContaining({ workplaceName: '上海园区二期' }),
    });
    expect(changeLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assignmentId: 'assignment-current',
        changedField: 'workplaceName',
        oldValue: '上海园区一期',
        newValue: '上海园区二期',
      }),
    });
  });

  it('creates the first employment period and primary assignment when all initial employment fields are supplied', async () => {
    const employeeUpdate = jest.fn().mockResolvedValue(undefined);
    const periodCreate = jest.fn().mockResolvedValue({ id: 'period-first' });
    const assignmentCreate = jest.fn().mockResolvedValue({ id: 'assignment-first' });
    const employmentRecordCreate = jest.fn().mockResolvedValue(undefined);
    const fieldChangeLogCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      employeeAssignment: { findFirst: jest.fn().mockResolvedValue(null), create: assignmentCreate },
      employeeIdentityDocument: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: { update: employeeUpdate, findUniqueOrThrow: jest.fn().mockResolvedValue(currentEmployee) },
      organization: { findFirst: jest.fn().mockResolvedValue({ id: 'org-target', code: 'TARGET', name: '新部门' }) },
      position: { findFirst: jest.fn() },
      employmentPeriod: { create: periodCreate },
      employmentRecord: { create: employmentRecordCreate },
      employeeFieldChangeLog: { create: fieldChangeLogCreate },
    };
    const service = new EmployeesService(
      { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)), employee: { findFirst: jest.fn().mockResolvedValue(currentEmployee) } } as never,
      { getEmployeeWhere: jest.fn().mockResolvedValue({}), assertOrganizationAccess: jest.fn().mockResolvedValue(undefined) } as never,
      { create: jest.fn() } as never,
      { enabled: false } as never,
    );

    await service.update(user, employeeId, {
      initialEmployment: {
        organizationId: 'org-target',
        entryDate: '2026-01-01',
        employmentRelationship: 'INTERNAL_EMPLOYEE',
        workArrangement: 'CONTRACT_EMPLOYMENT',
        employmentStatus: 'REGULAR',
      },
    } as never, auditContext);

    expect(periodCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        employeeId,
        sequenceNo: 1,
        employmentRelationship: 'INTERNAL_EMPLOYEE',
        employmentStatus: 'REGULAR',
      }),
    }));
    expect(assignmentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        employeeId,
        employmentPeriodId: 'period-first',
        organizationId: 'org-target',
        isPrimary: true,
        status: 'ACTIVE',
      }),
    }));
    expect(employmentRecordCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        employeeId,
        employmentPeriodId: 'period-first',
        status: 'REGULAR',
        currentFlag: true,
      }),
    }));
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-target' }) }));
  });

  it('selects a primary assignment only when its employment period has started', async () => {
    const assignmentFindFirst = jest.fn().mockResolvedValue(currentAssignment);
    const tx = {
      employeeAssignment: { findFirst: assignmentFindFirst, update: jest.fn(), create: jest.fn() },
      employeeIdentityDocument: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: { update: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue(currentEmployee) },
      organization: { findUniqueOrThrow: jest.fn() },
      employeeFieldChangeLog: { create: jest.fn() },
    };
    const service = new EmployeesService(
      { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)), employee: { findFirst: jest.fn().mockResolvedValue(currentEmployee) } } as never,
      { getEmployeeWhere: jest.fn().mockResolvedValue({}), assertOrganizationAccess: jest.fn() } as never,
      { create: jest.fn() } as never,
      { enabled: false } as never,
    );

    await service.update(user, employeeId, { organizationId: 'org-current' } as never, auditContext);

    expect(assignmentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        employeeId,
        isPrimary: true,
        status: 'ACTIVE',
        employmentPeriod: { entryDate: { lte: expect.any(Date) } },
      }),
    }));
  });

  it('does not create a new assignment when the submitted department is unchanged', async () => {
    const assignmentCreate = jest.fn();
    const tx = {
      employeeAssignment: { findFirst: jest.fn().mockResolvedValue(currentAssignment), update: jest.fn(), create: assignmentCreate },
      employeeIdentityDocument: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: { update: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue(currentEmployee) },
      organization: { findUniqueOrThrow: jest.fn() },
      employeeFieldChangeLog: { create: jest.fn() },
    };
    const access = { getEmployeeWhere: jest.fn().mockResolvedValue({}), assertOrganizationAccess: jest.fn() };
    const service = new EmployeesService(
      { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)), employee: { findFirst: jest.fn().mockResolvedValue(currentEmployee) } } as never,
      access as never,
      { create: jest.fn() } as never,
      { enabled: false } as never,
    );

    await service.update(user, employeeId, { organizationId: 'org-current' } as never, auditContext);

    expect(access.assertOrganizationAccess).not.toHaveBeenCalled();
    expect(assignmentCreate).not.toHaveBeenCalled();
  });

});

describe('EmployeesService database update document compatibility', () => {
  const employeeId = 'employee-document-1';
  const employee = {
    id: employeeId,
    employeeNo: 'FAKE-DOCUMENT-001',
    name: '虚构证件员工',
    mobile: '13900001007',
    idCardNo: '110101199901015001',
    organizationId: 'org-main',
    organization: { id: 'org-main', name: '虚构部门' },
    assignments: [],
    employmentPeriods: [],
    reportingAsEmployee: [],
    identityDocuments: [],
    familyMembers: [],
    educationExperiences: [],
    workExperiences: [],
    convertedCandidates: [],
    gender: null,
    workEmail: 'fictional.document@example.invalid',
    personalEmail: 'fictional.personal@example.invalid',
    birthDate: null,
    ethnicity: null,
    maritalStatus: null,
    politicalStatus: null,
    nativePlace: null,
    nativePlaceRegionCode: null,
    householdType: null,
    householdRegionCode: null,
    householdAddress: null,
    residentialRegionCode: null,
    residentialAddress: null,
    bankName: null,
    bankBranchName: null,
    bankAccountNumber: null,
    employmentRecords: [{ status: EmploymentStatus.REGULAR }],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const user = {
    id: 'user-admin',
    username: 'admin',
    displayName: '虚构管理员',
    role: 'ADMIN' as const,
    roleName: '管理员',
    permissions: [PERMISSIONS.EMPLOYEE_UPDATE],
    organizationIds: ['org-main'],
  };

  function createService(currentDocument: {
    id: string;
    documentType: 'NATIONAL_ID' | 'PASSPORT' | 'SINGAPORE_EP';
    documentNumber: string;
    expiryDate: Date | null;
  } | null) {
    const employeeUpdate = jest.fn().mockResolvedValue(undefined);
    const documentUpdate = jest.fn().mockResolvedValue(undefined);
    const documentCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      employeeAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeIdentityDocument: {
        findFirst: jest.fn().mockResolvedValue(currentDocument),
        update: documentUpdate,
        create: documentCreate,
      },
      employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: {
        update: employeeUpdate,
        findUniqueOrThrow: jest.fn().mockResolvedValue(employee),
      },
      employeeFieldChangeLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      employee: { findFirst: jest.fn().mockResolvedValue(employee) },
    };
    const service = new EmployeesService(
      prisma as never,
      { getEmployeeWhere: jest.fn().mockResolvedValue({}) } as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      { enabled: false } as never,
    );
    return { service, employeeUpdate, documentUpdate, documentCreate };
  }

  it('clears the legacy identifier when the primary document changes to a passport', async () => {
    const { service, employeeUpdate, documentUpdate } = createService({
      id: 'document-1',
      documentType: 'NATIONAL_ID',
      documentNumber: '110101199901015001',
      expiryDate: new Date('2036-01-01T00:00:00.000Z'),
    });

    await service.update(user, employeeId, {
      documentType: 'PASSPORT',
      documentNumber: 'PFAKE20260001',
    } as never, auditContext);

    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idCardNo: null }),
    }));
    expect(documentUpdate).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: expect.objectContaining({
        documentType: 'PASSPORT',
        documentNumber: 'PFAKE20260001',
      }),
    });
  });

  it('clears the legacy identifier when the primary document changes to a newly confirmed non-resident document', async () => {
    const { service, employeeUpdate, documentUpdate } = createService({
      id: 'document-1',
      documentType: 'NATIONAL_ID',
      documentNumber: '110101199901015001',
      expiryDate: new Date('2036-01-01T00:00:00.000Z'),
    });

    await service.update(user, employeeId, {
      documentType: 'SINGAPORE_EP',
      documentNumber: 'EPFAKE20260001',
    } as never, auditContext);

    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idCardNo: null }),
    }));
    expect(documentUpdate).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: expect.objectContaining({
        documentType: 'SINGAPORE_EP',
        documentNumber: 'EPFAKE20260001',
      }),
    });
  });

  it('synchronizes the legacy identifier when the primary document changes to a national ID', async () => {
    const { service, employeeUpdate, documentUpdate } = createService({
      id: 'document-1',
      documentType: 'PASSPORT',
      documentNumber: 'PFAKE20250001',
      expiryDate: new Date('2036-01-01T00:00:00.000Z'),
    });

    await service.update(user, employeeId, {
      documentType: 'NATIONAL_ID',
      documentNumber: '110101200001015001',
    } as never, auditContext);

    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idCardNo: '110101200001015001' }),
    }));
    expect(documentUpdate).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: expect.objectContaining({
        documentType: 'NATIONAL_ID',
        documentNumber: '110101200001015001',
      }),
    });
  });

  it('uses the current document type when only the document number changes', async () => {
    const { service, employeeUpdate, documentUpdate } = createService({
      id: 'document-1',
      documentType: 'NATIONAL_ID',
      documentNumber: '110101199901015001',
      expiryDate: null,
    });

    await service.update(user, employeeId, { documentNumber: '110101200001015001' } as never, auditContext);

    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idCardNo: '110101200001015001' }),
    }));
    expect(documentUpdate).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: expect.objectContaining({
        documentType: 'NATIONAL_ID',
        documentNumber: '110101200001015001',
      }),
    });
  });

  it('retains the current document type and number when only the expiry date changes', async () => {
    const { service, employeeUpdate, documentUpdate } = createService({
      id: 'document-1',
      documentType: 'NATIONAL_ID',
      documentNumber: '110101199901015001',
      expiryDate: new Date('2036-01-01T00:00:00.000Z'),
    });

    await service.update(user, employeeId, { documentExpiryDate: '2046-01-01' } as never, auditContext);

    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idCardNo: '110101199901015001' }),
    }));
    expect(documentUpdate).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: expect.objectContaining({
        documentType: 'NATIONAL_ID',
        documentNumber: '110101199901015001',
        expiryDate: new Date('2046-01-01T00:00:00.000Z'),
      }),
    });
  });

  it('rejects a document type change without a replacement number', async () => {
    const { service, employeeUpdate } = createService({
      id: 'document-1',
      documentType: 'NATIONAL_ID',
      documentNumber: '110101199901015001',
      expiryDate: null,
    });

    await expect(service.update(user, employeeId, { documentType: 'PASSPORT' } as never, auditContext))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(employeeUpdate).not.toHaveBeenCalled();
  });

  it('requires a type and number before creating a missing primary document', async () => {
    const { service, employeeUpdate, documentCreate } = createService(null);

    await expect(service.update(user, employeeId, { documentExpiryDate: '2046-01-01' } as never, auditContext))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(employeeUpdate).not.toHaveBeenCalled();
    expect(documentCreate).not.toHaveBeenCalled();
  });

  it('records an enum code and label snapshot when the primary document type changes', async () => {
    const currentDocument = {
      id: 'document-1',
      documentType: 'NATIONAL_ID' as const,
      documentNumber: '110101199901015001',
      expiryDate: null,
    };
    const changeLogCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      employeeAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeIdentityDocument: {
        findFirst: jest.fn().mockResolvedValue(currentDocument),
        update: jest.fn().mockResolvedValue(undefined),
      },
      employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: {
        update: jest.fn().mockResolvedValue(undefined),
        findUniqueOrThrow: jest.fn().mockResolvedValue(employee),
      },
      employeeFieldChangeLog: { create: changeLogCreate },
    };
    const service = new EmployeesService(
      {
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
        employee: { findFirst: jest.fn().mockResolvedValue(employee) },
      } as never,
      { getEmployeeWhere: jest.fn().mockResolvedValue({}) } as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      { enabled: false } as never,
    );

    await service.update(user, employeeId, {
      documentType: 'PASSPORT',
      documentNumber: 'PFAKE20260001',
    } as never, auditContext);

    expect(changeLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changedField: 'documentType',
        oldValue: { code: 'NATIONAL_ID', label: '身份证' },
        newValue: { code: 'PASSPORT', label: '护照' },
      }),
    });
  });

  it('records the confirmed enum code and label snapshot for profile changes', async () => {
    const current = {
      ...employee,
      bankName: 'ICBC',
    };
    const changeLogCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      employeeAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeIdentityDocument: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: {
        update: jest.fn().mockResolvedValue(undefined),
        findUniqueOrThrow: jest.fn().mockResolvedValue(current),
      },
      employeeFieldChangeLog: { create: changeLogCreate },
    };
    const service = new EmployeesService(
      {
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
        employee: { findFirst: jest.fn().mockResolvedValue(current) },
      } as never,
      { getEmployeeWhere: jest.fn().mockResolvedValue({}) } as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      { enabled: false } as never,
    );

    await service.update(user, employeeId, { bankName: 'ICBC' } as never, auditContext);
    expect(changeLogCreate).not.toHaveBeenCalled();

    await service.update(user, employeeId, { householdType: 'NONLOCAL_URBAN' } as never, auditContext);
    expect(changeLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changedField: 'householdType',
        oldValue: undefined,
        newValue: { code: 'NONLOCAL_URBAN', label: '外地城镇' },
      }),
    });
  });

  it('persists only valid administrative-region codes and audits their changes', async () => {
    const current = {
      ...employee,
      nativePlaceRegionCode: '110105',
      householdRegionCode: null,
      residentialRegionCode: null,
    };
    const employeeUpdate = jest.fn().mockResolvedValue(undefined);
    const changeLogCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      employeeAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeIdentityDocument: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: { update: employeeUpdate, findUniqueOrThrow: jest.fn().mockResolvedValue(current) },
      employeeFieldChangeLog: { create: changeLogCreate },
    };
    const service = new EmployeesService(
      {
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
        employee: { findFirst: jest.fn().mockResolvedValue(current) },
      } as never,
      { getEmployeeWhere: jest.fn().mockResolvedValue({}) } as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      { enabled: false } as never,
    );

    await service.update(user, employeeId, {
      nativePlaceRegionCode: '310115',
      householdRegionCode: '440305',
    } as never, auditContext);

    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nativePlaceRegionCode: '310115',
        householdRegionCode: '440305',
      }),
    }));
    expect(changeLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        changedField: 'nativePlaceRegionCode',
        oldValue: '110105',
        newValue: '310115',
      }),
    }));

    await expect(service.update(user, employeeId, { residentialRegionCode: '999999' } as never, auditContext))
      .rejects.toThrow('联系地址地区行政区划代码不存在');
  });

  it('records fixed assignment enum changes with stable code and label snapshots', async () => {
    const currentAssignment = {
      id: 'assignment-1',
      personnelPosition: 'FRONT_OFFICE',
      employeeLevel: 'STAFF',
      personnelCategory: 'NON_TALENT_PROGRAM',
      employmentRelationship: 'INTERNAL_EMPLOYEE',
      personnelSource: 'SOCIAL_RECRUITMENT',
      workArrangement: 'CONTRACT_EMPLOYMENT',
    };
    const assignmentUpdate = jest.fn().mockResolvedValue(undefined);
    const changeLogCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      employeeAssignment: {
        findFirst: jest.fn().mockResolvedValue(currentAssignment),
        update: assignmentUpdate,
      },
      employeeIdentityDocument: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: {
        update: jest.fn().mockResolvedValue(undefined),
        findUniqueOrThrow: jest.fn().mockResolvedValue(employee),
      },
      employeeFieldChangeLog: { create: changeLogCreate },
    };
    const service = new EmployeesService(
      {
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
        employee: { findFirst: jest.fn().mockResolvedValue(employee) },
      } as never,
      { getEmployeeWhere: jest.fn().mockResolvedValue({}) } as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      { enabled: false } as never,
    );

    await service.update(user, employeeId, {
      personnelPosition: 'MIDDLE_OFFICE',
      employeeLevel: 'MANAGER',
    } as never, auditContext);

    expect(assignmentUpdate).toHaveBeenCalledWith({
      where: { id: 'assignment-1' },
      data: expect.objectContaining({
        personnelPosition: 'MIDDLE_OFFICE',
        employeeLevel: 'MANAGER',
      }),
    });
    expect(changeLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId,
        assignmentId: 'assignment-1',
        changedField: 'personnelPosition',
        oldValue: { code: 'FRONT_OFFICE', label: '前台' },
        newValue: { code: 'MIDDLE_OFFICE', label: '中台' },
      }),
    });
    expect(changeLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId,
        assignmentId: 'assignment-1',
        changedField: 'employeeLevel',
        oldValue: { code: 'STAFF', label: '员工级' },
        newValue: { code: 'MANAGER', label: '经理级' },
      }),
    });
  });

  it('records profile and bank field changes with the previous and new values', async () => {
    const current = {
      ...employee,
      name: '原姓名',
      bankAccountNumber: '6222000000000000001',
    };
    const employeeUpdate = jest.fn().mockResolvedValue(undefined);
    const changeLogCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      employeeAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeIdentityDocument: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: {
        update: employeeUpdate,
        findUniqueOrThrow: jest.fn().mockResolvedValue(current),
      },
      employeeFieldChangeLog: { create: changeLogCreate },
    };
    const service = new EmployeesService(
      {
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
        employee: { findFirst: jest.fn().mockResolvedValue(current) },
      } as never,
      { getEmployeeWhere: jest.fn().mockResolvedValue({}) } as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      { enabled: false } as never,
    );

    await service.update(user, employeeId, {
      name: '新姓名',
      bankAccountNumber: '6222000000000000002',
    } as never, auditContext);

    expect(changeLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId,
        changedField: 'name',
        oldValue: '原姓名',
        newValue: '新姓名',
      }),
    });
    expect(changeLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId,
        changedField: 'bankAccountNumber',
        oldValue: '6222000000000000001',
        newValue: '6222000000000000002',
      }),
    });
  });
});

describe('EmployeesService database creation', () => {
  it('persists probation months and derives the labor-service agreement type', async () => {
    const employee = {
      id: 'employee-labor-1',
      employeeNo: 'FAKE-LABOR-001',
      name: '虚构劳务人员',
      mobile: '13900001006',
      idCardNo: 'FAKE-DOCUMENT-001',
      organizationId: 'org-main',
      organization: { id: 'org-main', name: '虚构部门' },
      assignments: [],
      employmentPeriods: [],
      reportingAsEmployee: [],
      identityDocuments: [],
      familyMembers: [],
      educationExperiences: [],
      workExperiences: [],
      convertedCandidates: [],
      gender: null,
      workEmail: 'fictional.labor@example.invalid',
      personalEmail: 'fictional.personal@example.invalid',
      birthDate: null,
      ethnicity: null,
      maritalStatus: null,
      politicalStatus: null,
      nativePlace: null,
      nativePlaceRegionCode: null,
      householdType: null,
      householdRegionCode: null,
      householdAddress: null,
      residentialRegionCode: null,
      residentialAddress: null,
      bankName: null,
      bankBranchName: null,
      bankAccountNumber: null,
      employmentRecords: [{ status: EmploymentStatus.REGULAR }],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const probationCreate = jest.fn().mockResolvedValue({ id: 'probation-1' });
    const agreementCreate = jest.fn().mockResolvedValue({ id: 'agreement-1' });
    const tx = {
      employee: {
        create: jest.fn().mockResolvedValue(employee),
        findUniqueOrThrow: jest.fn().mockResolvedValue(employee),
      },
      employmentPeriod: { create: jest.fn().mockResolvedValue({ id: 'period-1' }) },
      employeeAssignment: { create: jest.fn().mockResolvedValue({ id: 'assignment-1' }) },
      employeeIdentityDocument: { create: jest.fn().mockResolvedValue({ id: 'document-1' }) },
      employeeFamilyMember: { create: jest.fn().mockResolvedValue({ id: 'family-1' }) },
      employeeEducationExperience: { create: jest.fn().mockResolvedValue({ id: 'education-1' }) },
      employmentRecord: { create: jest.fn().mockResolvedValue({ id: 'record-1' }) },
      probationRecord: { create: probationCreate },
      reportingRelationship: { create: jest.fn() },
      employeeAgreement: { create: agreementCreate },
    };
    const prisma = {
      organization: { count: jest.fn().mockResolvedValue(1) },
      employingCompany: { count: jest.fn().mockResolvedValue(1) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const access = { assertOrganizationAccess: jest.fn().mockResolvedValue(undefined) };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new EmployeesService(
      prisma as never,
      access as never,
      audit as never,
      { enabled: false } as never,
    );
    const admin = {
      id: 'user-admin',
      username: 'admin',
      displayName: '虚构管理员',
      role: 'ADMIN' as const,
      roleName: '管理员',
      permissions: [PERMISSIONS.EMPLOYEE_CREATE],
      organizationIds: ['org-main'],
    };

    await service.create(admin, {
      employeeNo: 'FAKE-LABOR-001',
      name: '虚构劳务人员',
      workEmail: 'fictional.labor@example.invalid',
      personalEmail: 'fictional.personal@example.invalid',
      personnelCategory: 'NON_TALENT_PROGRAM',
      employmentRelationship: 'LABOR_WORKER',
      personnelSource: 'SOCIAL_RECRUITMENT',
      workArrangement: 'LABOR_EMPLOYMENT',
      mobile: '13900001006',
      documentType: 'OTHER',
      documentNumber: 'FAKE-DOCUMENT-001',
      documentExpiryDate: '2036-01-01',
      entryDate: '2026-01-01',
      organizationId: 'org-main',
      personnelPosition: 'FRONT_OFFICE',
      employeeLevel: 'STAFF',
      agreementEmployingCompanyId: 'company-1',
      householdType: 'LOCAL_URBAN',
      bankName: 'ICBC',
      bankBranchName: '虚构支行',
      bankAccountNumber: '6222000000000000001',
      birthDate: '2000-01-01',
      ethnicity: 'HAN',
      maritalStatus: 'UNMARRIED',
      politicalStatus: 'NON_PARTY',
      householdAddress: '虚构户籍地址',
      residentialAddress: '虚构联系地址',
      emergencyContactName: '虚构联系人',
      emergencyContactRelationship: '家属',
      emergencyContactMobile: '13900002002',
      graduationSchoolName: '虚构大学',
      institutionType: 'RANK_985',
      highestEducation: 'BACHELOR',
      graduationDate: '2022-06-30',
      major: '虚构专业',
      hasProbation: true,
      probationMonths: 3,
      probationEndDate: '2026-04-01',
      contractTermType: 'FIXED',
      contractMonths: 12,
      contractEndDate: '2027-01-01',
      employmentStatus: EmploymentStatus.REGULAR,
    } as never, auditContext);

    expect(probationCreate).toHaveBeenCalledWith({
      data: {
        employeeId: 'employee-labor-1',
        employmentPeriodId: 'period-1',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        plannedEndDate: new Date('2026-04-01T00:00:00.000Z'),
        probationMonths: 3,
        status: 'IN_PROGRESS',
      },
    });
    expect(agreementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 'employee-labor-1',
        employmentPeriodId: 'period-1',
        agreementType: 'LABOR_SERVICE_CONTRACT',
        employingCompanyId: 'company-1',
      }),
    });
    expect(tx.employmentPeriod.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        personnelCategory: 'NON_TALENT_PROGRAM',
        personnelSource: 'SOCIAL_RECRUITMENT',
        employmentRelationship: 'LABOR_WORKER',
      }),
    });
    expect(tx.employeeAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        personnelPosition: 'FRONT_OFFICE',
        employeeLevel: 'STAFF',
      }),
    });
    expect(tx.employeeAssignment.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ employingCompanyId: expect.anything() }),
    });
  });
});
