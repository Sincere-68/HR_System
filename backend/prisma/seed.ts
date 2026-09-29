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
import { EMPLOYING_COMPANY_CATALOG, ORGANIZATION_CATALOG, POSITION_CATALOG } from '@hr-demo/shared';
import * as bcrypt from 'bcrypt';
import {
  ACCESS_CONTROL_PERMISSION_DEFINITIONS,
  ACCESS_CONTROL_ROLE_DEFINITIONS,
} from './access-policy';

const prisma = new PrismaClient();

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
  for (const { code, name, sortOrder } of EMPLOYING_COMPANY_CATALOG) {
    const id = `employing-company-${String(sortOrder).padStart(3, '0')}`;
    await prisma.employingCompany.upsert({
      where: { code },
      update: { name, sortOrder, status: RecordStatus.ACTIVE, archivedAt: null },
      create: { id, code, name, sortOrder, status: RecordStatus.ACTIVE },
    });
  }

  for (const { code, name } of ACCESS_CONTROL_PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  }

  const roles = new Map<string, { id: string }>();
  for (const role of ACCESS_CONTROL_ROLE_DEFINITIONS) {
    roles.set(role.code, await upsertRole(role.code, role.name, role.permissionCodes));
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

  await prisma.$transaction(
    POSITION_CATALOG.map(({ name }) => prisma.position.upsert({
      where: { name },
      update: { status: RecordStatus.ACTIVE, archivedAt: null },
      create: { name, organizationId: null, status: RecordStatus.ACTIVE },
    })),
  );

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

  // 只引导创建一个系统管理员。HR 和普通员工账号均以 users 表为准，
  // 后续 seed 不会重置管理员密码，也不会创建额外的固定测试账号。
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' },
    select: { id: true },
  });
  const bootstrapAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!existingAdmin && !bootstrapAdminPassword) {
    throw new Error('首次初始化必须设置 BOOTSTRAP_ADMIN_PASSWORD；管理员创建后可从环境变量中移除该值');
  }
  const admin = existingAdmin
    ? await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { displayName: '系统管理员', roleId: roles.get('ADMIN')!.id },
      })
    : await prisma.user.create({
        data: {
          username: 'admin',
          displayName: '系统管理员',
          passwordHash: await bcrypt.hash(bootstrapAdminPassword!, 12),
          roleId: roles.get('ADMIN')!.id,
        },
      });
  await prisma.userDataScope.deleteMany({ where: { userId: admin.id } });

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
        nativePlaceRegionName: '虚构籍贯',
        householdRegionName: '虚构户籍所在地',
        residentialRegionName: '虚构联系地址',
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
        nativePlaceRegionName: '虚构籍贯',
        householdRegionName: '虚构户籍所在地',
        residentialRegionName: '虚构联系地址',
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

  console.log('本地 Demo 数据已写入。仅初始化系统管理员 admin；HR 和普通员工账号请在 users 表中维护。');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
