import {
  AssignmentStatus,
  AssignmentType,
  BankName,
  EducationLevel,
  EmploymentRelationship,
  EmploymentStatus,
  Ethnicity,
  HouseholdType,
  InstitutionType,
  MaritalStatus,
  PersonnelCategory,
  PersonnelPosition,
  PersonnelSource,
  PoliticalStatus,
  EmployeeLevel,
  IdentityDocumentType,
  PrismaClient,
  RecordStatus,
  WorkArrangement,
} from '@prisma/client';
import { ORGANIZATION_CATALOG } from '@hr-demo/shared';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Only clearly fictional directory data belongs in local demo seed data.
const companyNames = [
  '虚构全日制公司一号',
  '虚构全日制公司二号',
  '虚构全日制公司三号',
] as const;

const permissionDefinitions = [
  ['employee.read', '查看员工'],
  ['employee.create', '新增员工'],
  ['employee.update', '编辑员工'],
  ['employee.data.all', '查看全部部门员工'],
  ['organization.read', '查看组织'],
  ['performance.read', '查看绩效'],
  ['performance.template.manage', '管理绩效模板'],
  ['performance.cycle.manage', '管理绩效周期'],
  ['performance.task.handle', '处理绩效任务'],
  ['performance.result.modify', '修改绩效结果'],
  ['performance.amount-base.manage', '管理绩效金额基数'],
] as const;

const roleDefinitions = [
  {
    code: 'ADMIN',
    name: '管理员',
    permissions: permissionDefinitions.map(([code]) => code),
  },
  {
    code: 'DEPT_ADMIN',
    name: '部门管理员',
    permissions: ['employee.read', 'employee.create', 'employee.update', 'organization.read', 'performance.read', 'performance.cycle.manage', 'performance.task.handle'],
  },
  {
    code: 'VIEWER',
    name: '普通账户',
    permissions: [],
  },
] as const;

async function upsertRole(
  code: string,
  name: string,
  permissionCodes: readonly string[],
) {
  const permissionIds = await prisma.permission.findMany({
    where: { code: { in: [...permissionCodes] } },
    select: { id: true },
  });

  return prisma.role.upsert({
    where: { code },
    update: {
      name,
      permissions: {
        deleteMany: {},
        create: permissionIds.map(({ id }) => ({ permissionId: id })),
      },
    },
    create: {
      code,
      name,
      permissions: {
        create: permissionIds.map(({ id }) => ({ permissionId: id })),
      },
    },
  });
}

async function main() {
  for (const [index, name] of companyNames.entries()) {
    const code = `COMPANY_${String(index + 1).padStart(3, '0')}`;
    const id = `employing-company-${String(index + 1).padStart(3, '0')}`;
    await prisma.employingCompany.upsert({ where: { code }, update: { name, sortOrder: index + 1 }, create: { id, code, name, sortOrder: index + 1 } });
  }

  for (const [code, name] of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  }

  const roles = new Map<string, { id: string }>();
  for (const role of roleDefinitions) {
    roles.set(role.code, await upsertRole(role.code, role.name, role.permissions));
  }

  const organizationsByCode = new Map<string, { id: string }>();
  for (const entry of ORGANIZATION_CATALOG) {
    const id = `organization-${entry.code.toLocaleLowerCase()}`;
    const parentId = entry.parentCode
      ? organizationsByCode.get(entry.parentCode)?.id
      : undefined;
    if (entry.parentCode && !parentId) {
      throw new Error(`组织目录父节点未先创建：${entry.parentCode}`);
    }
    const organization = await prisma.organization.upsert({
      where: { code: entry.code },
      update: {
        name: entry.name,
        parentId: parentId ?? null,
        sortOrder: entry.sortOrder,
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        archivedById: null,
        archiveReason: null,
      },
      create: {
        id,
        code: entry.code,
        name: entry.name,
        parentId: parentId ?? null,
        sortOrder: entry.sortOrder,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true },
    });
    organizationsByCode.set(entry.code, organization);
  }
  const organization = (code: string) => {
    const result = organizationsByCode.get(code);
    if (!result) throw new Error(`组织目录缺少编码：${code}`);
    return result.id;
  };
  const legacyOrganizations = await prisma.organization.findMany({
    where: { code: { notIn: ORGANIZATION_CATALOG.map(({ code }) => code) } },
    select: { id: true },
  });
  const legacyOrganizationIds = legacyOrganizations.map(({ id }) => id);
  const legacyAssignments = legacyOrganizationIds.length > 0
    ? await prisma.employeeAssignment.findMany({
        where: { organizationId: { in: legacyOrganizationIds } },
        select: { id: true },
      })
    : [];
  if (legacyAssignments.length > 0) {
    await prisma.employeeFieldChangeLog.deleteMany({
      where: { assignmentId: { in: legacyAssignments.map(({ id }) => id) } },
    });
    await prisma.employeeAssignment.deleteMany({
      where: { id: { in: legacyAssignments.map(({ id }) => id) } },
    });
  }
  if (legacyOrganizationIds.length > 0) {
    await prisma.userDataScope.deleteMany({ where: { organizationId: { in: legacyOrganizationIds } } });
    await prisma.employee.updateMany({
      where: { organizationId: { in: legacyOrganizationIds } },
      data: { organizationId: organization('COMPANY_SHANGHAI_YIXIN') },
    });
    await prisma.position.updateMany({
      where: { organizationId: { in: legacyOrganizationIds } },
      data: { organizationId: null },
    });
    await prisma.jobTitle.updateMany({
      where: { organizationId: { in: legacyOrganizationIds } },
      data: { organizationId: null },
    });
    await prisma.offer.updateMany({
      where: { organizationId: { in: legacyOrganizationIds } },
      data: { organizationId: null },
    });
    await prisma.employeeMovement.updateMany({
      where: {
        OR: [
          { fromOrganizationId: { in: legacyOrganizationIds } },
          { toOrganizationId: { in: legacyOrganizationIds } },
        ],
      },
      data: { fromOrganizationId: null, toOrganizationId: null },
    });
    await prisma.staffingPlan.deleteMany({ where: { organizationId: { in: legacyOrganizationIds } } });
    await prisma.organization.updateMany({
      where: { id: { in: legacyOrganizationIds } },
      data: { parentId: null },
    });
    // Delete individually after detaching every legacy child. MySQL can reject
    // a bulk delete of self-referencing organization rows even after parentId
    // is cleared because it does not guarantee a child-first delete order.
    for (const legacyOrganizationId of legacyOrganizationIds) {
      await prisma.organization.deleteMany({ where: { id: legacyOrganizationId } });
    }
  }

  const userDefinitions = [
    {
      username: 'admin',
      displayName: '系统管理员',
      roleCode: 'ADMIN',
      password: process.env.SEED_ADMIN_PASSWORD ?? 'Demo@123',
      scopeOrganizationIds: [] as string[],
    },
    {
      username: 'deptadmin',
      displayName: '部门管理员',
      roleCode: 'DEPT_ADMIN',
      password: process.env.SEED_DEPT_ADMIN_PASSWORD ?? 'Demo@123',
      scopeOrganizationIds: [organization('CEO_CHEN_RUI')],
    },
    {
      username: 'viewer',
      displayName: '普通账户',
      roleCode: 'VIEWER',
      password: process.env.SEED_VIEWER_PASSWORD ?? 'Demo@123',
      scopeOrganizationIds: [organization('CHAIRMAN_CUSTOMER_SERVICE')],
    },
  ];

  for (const definition of userDefinitions) {
    const user = await prisma.user.upsert({
      where: { username: definition.username },
      update: {
        displayName: definition.displayName,
        passwordHash: await bcrypt.hash(definition.password, 12),
        roleId: roles.get(definition.roleCode)!.id,
      },
      create: {
        username: definition.username,
        displayName: definition.displayName,
        passwordHash: await bcrypt.hash(definition.password, 12),
        roleId: roles.get(definition.roleCode)!.id,
      },
    });

    await prisma.userDataScope.deleteMany({ where: { userId: user.id } });
    if (definition.scopeOrganizationIds.length > 0) {
      await prisma.userDataScope.createMany({
        data: definition.scopeOrganizationIds.map((organizationId) => ({
          userId: user.id,
          organizationId,
        })),
      });
    }
  }

  const employees = [
    {
      employeeNo: 'DEMO-1001',
      name: '林知夏',
      mobile: '13800001001',
      idCardNo: '110101199203181021',
      organizationId: organization('CEO_SECOND_TMALL_SUPERMARKET'),
      status: EmploymentStatus.REGULAR,
    },
    {
      employeeNo: 'DEMO-1002',
      name: '周予安',
      mobile: '13800001002',
      idCardNo: '310101199507092036',
      organizationId: organization('CEO_SECOND_TMALL_SUPERMARKET'),
      status: EmploymentStatus.REGULAR,
    },
    {
      employeeNo: 'DEMO-2001',
      name: '陈嘉禾',
      mobile: '13800002001',
      idCardNo: '440101198911262412',
      organizationId: organization('CEO_STORAGE'),
      status: EmploymentStatus.RESIGNED,
    },
    {
      employeeNo: 'DEMO-3001',
      name: '许星澜',
      mobile: '13800003001',
      idCardNo: '510101199604112527',
      organizationId: organization('CHAIRMAN_CUSTOMER_SERVICE'),
      status: EmploymentStatus.REGULAR,
    },
  ];

  for (const definition of employees) {
    const employee = await prisma.employee.upsert({
      where: { employeeNo: definition.employeeNo },
      update: {
        name: definition.name,
        mobile: definition.mobile,
        idCardNo: definition.idCardNo,
        organizationId: definition.organizationId,
        workEmail: `${definition.employeeNo.toLowerCase()}@example.invalid`,
        personalEmail: `${definition.employeeNo.toLowerCase()}.personal@example.invalid`,
        ethnicity: Ethnicity.HAN,
        maritalStatus: MaritalStatus.UNMARRIED,
        politicalStatus: PoliticalStatus.NON_PARTY,
        householdType: HouseholdType.LOCAL_URBAN,
        householdAddress: '虚构户籍地址',
        residentialAddress: '虚构联系地址',
        bankName: BankName.ICBC,
        bankBranchName: '虚构支行',
        bankAccountNumber: '6222000000000000001',
      },
      create: {
        employeeNo: definition.employeeNo,
        name: definition.name,
        mobile: definition.mobile,
        idCardNo: definition.idCardNo,
        organizationId: definition.organizationId,
        workEmail: `${definition.employeeNo.toLowerCase()}@example.invalid`,
        personalEmail: `${definition.employeeNo.toLowerCase()}.personal@example.invalid`,
        ethnicity: Ethnicity.HAN,
        maritalStatus: MaritalStatus.UNMARRIED,
        politicalStatus: PoliticalStatus.NON_PARTY,
        householdType: HouseholdType.LOCAL_URBAN,
        householdAddress: '虚构户籍地址',
        residentialAddress: '虚构联系地址',
        bankName: BankName.ICBC,
        bankBranchName: '虚构支行',
        bankAccountNumber: '6222000000000000001',
      },
    });

    const currentPeriod = await prisma.employmentPeriod.upsert({
      where: {
        employeeId_sequenceNo: {
          employeeId: employee.id,
          sequenceNo: 1,
        },
      },
      update: {
        employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
        employmentStatus: definition.status,
        status: RecordStatus.ACTIVE,
      },
      create: {
        employeeId: employee.id,
        sequenceNo: 1,
        employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
        entryDate: new Date('2026-01-01T00:00:00.000Z'),
        employmentStatus: definition.status,
        isRehire: false,
        status: RecordStatus.ACTIVE,
      },
    });

    const primaryAssignment = await prisma.employeeAssignment.findFirst({
      where: {
        employeeId: employee.id,
        employmentPeriodId: currentPeriod.id,
        isPrimary: true,
        status: AssignmentStatus.ACTIVE,
        endDate: null,
      },
    });
    if (primaryAssignment) {
      await prisma.employeeAssignment.update({
        where: { id: primaryAssignment.id },
        data: {
          organizationId: definition.organizationId,
          assignmentType: AssignmentType.PRIMARY,
          personnelPosition: PersonnelPosition.BACK_OFFICE,
          employeeLevel: EmployeeLevel.STAFF,
          personnelCategory: PersonnelCategory.NON_TALENT_PROGRAM,
          employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
          personnelSource: PersonnelSource.SOCIAL_RECRUITMENT,
          workArrangement: WorkArrangement.CONTRACT_EMPLOYMENT,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
    } else {
      await prisma.employeeAssignment.create({
        data: {
          employeeId: employee.id,
          employmentPeriodId: currentPeriod.id,
          organizationId: definition.organizationId,
          assignmentType: AssignmentType.PRIMARY,
          personnelPosition: PersonnelPosition.BACK_OFFICE,
          employeeLevel: EmployeeLevel.STAFF,
          personnelCategory: PersonnelCategory.NON_TALENT_PROGRAM,
          employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
          personnelSource: PersonnelSource.SOCIAL_RECRUITMENT,
          workArrangement: WorkArrangement.CONTRACT_EMPLOYMENT,
          isPrimary: true,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          status: AssignmentStatus.ACTIVE,
        },
      });
    }

    await prisma.employeeAgreement.upsert({
      where: { agreementNo: `${definition.employeeNo}-P1` },
      update: {
        employeeId: employee.id,
        employmentPeriodId: currentPeriod.id,
        agreementType: 'LABOR_CONTRACT',
        employingCompanyId: 'employing-company-001',
        signingDate: new Date('2026-01-01T00:00:00.000Z'),
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: null,
        status: 'ACTIVE',
      },
      create: {
        employeeId: employee.id,
        employmentPeriodId: currentPeriod.id,
        agreementNo: `${definition.employeeNo}-P1`,
        agreementType: 'LABOR_CONTRACT',
        employingCompanyId: 'employing-company-001',
        signingDate: new Date('2026-01-01T00:00:00.000Z'),
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        status: 'ACTIVE',
      },
    });

    await prisma.employeeIdentityDocument.upsert({
      where: {
        documentType_documentNumber: {
          documentType: IdentityDocumentType.NATIONAL_ID,
          documentNumber: definition.idCardNo,
        },
      },
      update: {
        employeeId: employee.id,
        isPrimary: true,
        status: RecordStatus.ACTIVE,
      },
      create: {
        employeeId: employee.id,
        documentType: IdentityDocumentType.NATIONAL_ID,
        documentNumber: definition.idCardNo,
        isPrimary: true,
        status: RecordStatus.ACTIVE,
      },
    });

    const currentRecord = await prisma.employmentRecord.findFirst({
      where: { employeeId: employee.id, currentFlag: true },
    });
    if (!currentRecord) {
      await prisma.employmentRecord.create({
        data: {
          employeeId: employee.id,
          employmentPeriodId: currentPeriod.id,
          status: definition.status,
          effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
          currentFlag: true,
        },
      });
    } else if (currentRecord.status !== definition.status) {
      await prisma.$transaction([
        prisma.employmentRecord.update({
          where: { id: currentRecord.id },
          data: {
            employmentPeriodId: currentPeriod.id,
            endedAt: new Date('2025-12-31T23:59:59.999Z'),
            currentFlag: null,
          },
        }),
        prisma.employmentRecord.create({
          data: {
            employeeId: employee.id,
            employmentPeriodId: currentPeriod.id,
            status: definition.status,
            effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
            currentFlag: true,
          },
        }),
      ]);
    } else if (currentRecord.employmentPeriodId !== currentPeriod.id) {
      await prisma.employmentRecord.update({
        where: { id: currentRecord.id },
        data: { employmentPeriodId: currentPeriod.id },
      });
    }
  }

  console.log('本地 Demo 数据已写入。账号：admin、deptadmin、viewer。');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
