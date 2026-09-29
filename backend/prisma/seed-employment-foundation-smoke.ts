import {
  ApprovalFlowDefinitionStatus,
  ApprovalFlowVersionStatus,
  AssignmentStatus,
  AssignmentType,
  EmploymentRelationship,
  EmploymentStatus,
  PersonnelCategory,
  PersonnelSource,
  Prisma,
  PrismaClient,
  RecordStatus,
  WorkArrangement,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const prefix = 'MOCK-HR-STAGE2-';
const businessTypes = ['INTERN_TO_EMPLOYEE', 'LABOR_TO_EMPLOYEE', 'PART_TIME_RECORD'];
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

const ids = {
  organizationA: 'stage2-organization-a',
  organizationB: 'stage2-organization-b',
  positionA: 'stage2-position-a',
  positionB: 'stage2-position-b',
  jobTitleA: 'stage2-job-title-a',
  jobTitleB: 'stage2-job-title-b',
  applicant: 'stage2-user-applicant',
  approverOne: 'stage2-user-approver-one',
  approverTwo: 'stage2-user-approver-two',
  outsider: 'stage2-user-outsider',
  viewer: 'stage2-user-viewer',
} as const;

const employees = {
  conversionHappy: 'conversion-happy',
  conversionRollback: 'conversion-rollback',
  conversionWithdraw: 'conversion-withdraw',
  conversionReturn: 'conversion-return',
  conversionReject: 'conversion-reject',
  partTimeHappy: 'part-time-happy',
  partTimeFuture: 'part-time-future',
  partTimeReject: 'part-time-reject',
  partTimeWithdraw: 'part-time-withdraw',
  partTimeReturn: 'part-time-return',
  manager: 'manager',
} as const;

type FixtureKey = keyof typeof employees;
type FixtureInput = {
  key: FixtureKey;
  name: string;
  relationship: EmploymentRelationship;
  employmentStatus: EmploymentStatus;
  workArrangement: WorkArrangement;
  withEmploymentRecord?: boolean;
};

function assertIsolatedDatabase() {
  if (process.env.EMPLOYMENT_STAGE2_SEED !== 'isolated-test-only') {
    throw new Error('Set EMPLOYMENT_STAGE2_SEED=isolated-test-only for the Stage 2 fixture database');
  }
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Stage 2 fixtures must use local PostgreSQL');
  }
  if (url.pathname !== '/hr_personnel_demo_test') {
    throw new Error('Stage 2 fixtures must target hr_personnel_demo_test');
  }
}

async function removePreviousFixtures(tx: Prisma.TransactionClient) {
  const priorUsers = await tx.user.findMany({
    where: { username: { startsWith: prefix } },
    select: { id: true },
  });
  const priorEmployees = await tx.employee.findMany({
    where: { employeeNo: { startsWith: prefix } },
    select: { id: true },
  });
  const priorDefinitions = await tx.approvalFlowDefinition.findMany({
    where: { code: { startsWith: prefix } },
    select: { id: true, versions: { select: { id: true } } },
  });
  const userIds = priorUsers.map(({ id }) => id);
  const employeeIds = priorEmployees.map(({ id }) => id);
  const definitionIds = priorDefinitions.map(({ id }) => id);
  const versionIds = priorDefinitions.flatMap(({ versions }) => versions.map(({ id }) => id));
  const fixtureApprovalRequests = await tx.approvalRequest.findMany({
    where: {
      OR: [
        ...(userIds.length ? [{ applicantUserId: { in: userIds } }] : []),
        ...(versionIds.length ? [{ flowVersionId: { in: versionIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const fixtureApprovalIds = fixtureApprovalRequests.map(({ id }) => id);
  const priorConversions = employeeIds.length || fixtureApprovalIds.length
    ? await tx.employmentConversion.findMany({
        where: {
          OR: [
            ...(employeeIds.length ? [{ employeeId: { in: employeeIds } }] : []),
            ...(fixtureApprovalIds.length ? [{ approvalRequestId: { in: fixtureApprovalIds } }] : []),
          ],
        },
        select: { id: true, approvalRequestId: true },
      })
    : [];
  const priorPartTimeRecords = employeeIds.length || fixtureApprovalIds.length
    ? await tx.partTimeRecord.findMany({
        where: {
          OR: [
            ...(employeeIds.length ? [
              { employeeId: { in: employeeIds } },
              { managerEmployeeId: { in: employeeIds } },
            ] : []),
            ...(fixtureApprovalIds.length ? [{ approvalRequestId: { in: fixtureApprovalIds } }] : []),
          ],
        },
        select: { id: true, approvalRequestId: true },
      })
    : [];
  const businessIds = [
    ...priorConversions.map(({ id }) => id),
    ...priorPartTimeRecords.map(({ id }) => id),
  ];
  const approvalRequestIds = [
    ...fixtureApprovalIds,
    ...priorConversions.map(({ approvalRequestId }) => approvalRequestId),
    ...priorPartTimeRecords.map(({ approvalRequestId }) => approvalRequestId),
  ].filter((id, index, ids): id is string => Boolean(id) && ids.indexOf(id) === index);

  if (userIds.length || businessIds.length || approvalRequestIds.length || definitionIds.length || versionIds.length) {
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          ...(userIds.length ? [{ userId: { in: userIds } }] : []),
          ...(businessIds.length || approvalRequestIds.length || definitionIds.length || versionIds.length
            ? [{ resourceId: { in: [...businessIds, ...approvalRequestIds, ...definitionIds, ...versionIds] } }]
            : []),
        ],
      },
    });
  }
  if (priorPartTimeRecords.length) {
    await tx.partTimeRecord.deleteMany({
      where: { id: { in: priorPartTimeRecords.map(({ id }) => id) } },
    });
  }
  if (priorConversions.length) {
    await tx.employmentConversion.deleteMany({
      where: { id: { in: priorConversions.map(({ id }) => id) } },
    });
  }
  if (approvalRequestIds.length || userIds.length || versionIds.length) {
    await tx.approvalRequest.deleteMany({
      where: {
        OR: [
          ...(approvalRequestIds.length ? [{ id: { in: approvalRequestIds } }] : []),
          ...(userIds.length ? [{ applicantUserId: { in: userIds } }] : []),
          ...(versionIds.length ? [{ flowVersionId: { in: versionIds } }] : []),
        ],
      },
    });
  }
  if (versionIds.length) {
    await tx.approvalFlowNode.deleteMany({ where: { flowVersionId: { in: versionIds } } });
    await tx.approvalFlowVersion.deleteMany({ where: { id: { in: versionIds } } });
  }
  if (definitionIds.length) {
    await tx.approvalFlowDefinition.deleteMany({ where: { id: { in: definitionIds } } });
  }
  if (userIds.length) {
    await tx.userDataScope.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  }
  if (employeeIds.length) {
    await tx.reportingRelationship.deleteMany({
      where: {
        OR: [
          { employeeId: { in: employeeIds } },
          { managerEmployeeId: { in: employeeIds } },
        ],
      },
    });
    await tx.employeeFieldChangeLog.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await tx.employmentRecord.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await tx.employeeAssignment.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await tx.employmentPeriod.updateMany({
      where: { employeeId: { in: employeeIds } },
      data: { previousPeriodId: null },
    });
    await tx.employmentPeriod.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await tx.employee.deleteMany({ where: { id: { in: employeeIds } } });
  }
  await tx.jobTitle.deleteMany({ where: { code: { startsWith: prefix } } });
  await tx.position.deleteMany({ where: { name: { startsWith: `${prefix}职位-` } } });
  await tx.organization.deleteMany({ where: { code: { startsWith: prefix } } });
}

async function archivePublishedTestFlows(tx: Prisma.TransactionClient) {
  const published = await tx.approvalFlowDefinition.findMany({
    where: {
      businessType: { in: businessTypes },
      status: ApprovalFlowDefinitionStatus.PUBLISHED,
    },
    select: { id: true },
  });
  const definitionIds = published.map(({ id }) => id);
  if (!definitionIds.length) return;
  await tx.approvalFlowVersion.updateMany({
    where: {
      definitionId: { in: definitionIds },
      status: ApprovalFlowVersionStatus.PUBLISHED,
    },
    data: { status: ApprovalFlowVersionStatus.ARCHIVED },
  });
  await tx.approvalFlowDefinition.updateMany({
    where: { id: { in: definitionIds } },
    data: {
      status: ApprovalFlowDefinitionStatus.ARCHIVED,
      archivedAt: new Date(),
    },
  });
}

async function createEmploymentFixture(tx: Prisma.TransactionClient, input: FixtureInput) {
  const key = employees[input.key];
  const employeeId = `stage2-employee-${key}`;
  const periodId = `stage2-period-${key}`;
  const assignmentId = `stage2-assignment-${key}`;
  const recordId = `stage2-employment-record-${key}`;
  const employeeNo = `${prefix}${key.toUpperCase()}`;
  const startDate = date('2026-01-01');

  await tx.employee.create({
    data: {
      id: employeeId,
      employeeNo,
      name: input.name,
      organizationId: ids.organizationA,
      recordStatus: RecordStatus.ACTIVE,
    },
  });
  await tx.employmentPeriod.create({
    data: {
      id: periodId,
      employeeId,
      sequenceNo: 1,
      personnelCategory: PersonnelCategory.NON_TALENT_PROGRAM,
      personnelSource: PersonnelSource.SOCIAL_RECRUITMENT,
      employmentRelationship: input.relationship,
      entryDate: startDate,
      employmentStatus: input.employmentStatus,
      status: RecordStatus.ACTIVE,
    },
  });
  await tx.employeeAssignment.create({
    data: {
      id: assignmentId,
      employeeId,
      employmentPeriodId: periodId,
      organizationId: ids.organizationA,
      positionId: ids.positionA,
      jobTitleId: ids.jobTitleA,
      jobLevel: 'S2',
      personnelCategory: PersonnelCategory.NON_TALENT_PROGRAM,
      personnelSource: PersonnelSource.SOCIAL_RECRUITMENT,
      employmentRelationship: input.relationship,
      assignmentType: AssignmentType.PRIMARY,
      workArrangement: input.workArrangement,
      isPrimary: true,
      startDate,
      status: AssignmentStatus.ACTIVE,
    },
  });
  if (input.withEmploymentRecord !== false) {
    await tx.employmentRecord.create({
      data: {
        id: recordId,
        employeeId,
        employmentPeriodId: periodId,
        status: input.employmentStatus,
        effectiveAt: startDate,
        currentFlag: true,
      },
    });
  }
}

async function main() {
  assertIsolatedDatabase();
  const databaseRows = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  if (databaseRows[0]?.current_database !== 'hr_personnel_demo_test') {
    throw new Error(`Connected to unexpected database: ${databaseRows[0]?.current_database ?? 'unknown'}`);
  }
  const password = process.env.EMPLOYMENT_STAGE2_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('Set EMPLOYMENT_STAGE2_PASSWORD to at least 12 characters');
  }
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    await removePreviousFixtures(tx);
    await archivePublishedTestFlows(tx);

    const permissions = await Promise.all([
      ['employee.read', '查看 Stage 2 虚构员工'],
      ['employee.update', '修改 Stage 2 虚构员工'],
      ['employee.data.all', '查看全部 Stage 2 虚构员工'],
      ['organization.read', '查看 Stage 2 虚构组织'],
      ['employment.approval-flow.manage', '管理 Stage 2 虚构任职审批流程'],
    ].map(([code, name]) => tx.permission.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    })));
    const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission]));
    const adminRole = await tx.role.upsert({
      where: { code: 'ADMIN' },
      update: { name: 'Stage 2 本地管理员' },
      create: { code: 'ADMIN', name: 'Stage 2 本地管理员' },
    });
    const departmentRole = await tx.role.upsert({
      where: { code: 'DEPT_ADMIN' },
      update: { name: 'Stage 2 本地部门管理员' },
      create: { code: 'DEPT_ADMIN', name: 'Stage 2 本地部门管理员' },
    });
    const viewerRole = await tx.role.upsert({
      where: { code: 'VIEWER' },
      update: { name: 'Stage 2 本地只登录账号' },
      create: { code: 'VIEWER', name: 'Stage 2 本地只登录账号' },
    });
    for (const code of [
      'employee.read',
      'employee.update',
      'employee.data.all',
      'organization.read',
      'employment.approval-flow.manage',
    ]) {
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permissionByCode.get(code)!.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permissionByCode.get(code)!.id,
        },
      });
    }
    for (const code of ['employee.read', 'employee.update', 'organization.read']) {
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: departmentRole.id,
            permissionId: permissionByCode.get(code)!.id,
          },
        },
        update: {},
        create: {
          roleId: departmentRole.id,
          permissionId: permissionByCode.get(code)!.id,
        },
      });
    }

    await tx.organization.createMany({
      data: [
        { id: ids.organizationA, code: `${prefix}ORG-A`, name: '星河科技虚构研发中心' },
        { id: ids.organizationB, code: `${prefix}ORG-B`, name: '星河科技虚构交付中心' },
      ],
    });
    await tx.position.createMany({
      data: [
        { id: ids.positionA, name: `${prefix}职位-研发工程师`, organizationId: ids.organizationA },
        { id: ids.positionB, name: `${prefix}职位-交付顾问`, organizationId: ids.organizationB },
      ],
    });
    await tx.jobTitle.createMany({
      data: [
        { id: ids.jobTitleA, code: `${prefix}JOB-A`, name: '虚构研发工程师职务', organizationId: ids.organizationA },
        { id: ids.jobTitleB, code: `${prefix}JOB-B`, name: '虚构交付顾问职务', organizationId: ids.organizationB },
      ],
    });

    await tx.user.createMany({
      data: [
        {
          id: ids.applicant,
          username: `${prefix}applicant`,
          displayName: 'Stage 2 虚构申请人',
          passwordHash,
          roleId: adminRole.id,
        },
        {
          id: ids.approverOne,
          username: `${prefix}approver-one`,
          displayName: 'Stage 2 虚构一级审批人',
          passwordHash,
          roleId: departmentRole.id,
        },
        {
          id: ids.approverTwo,
          username: `${prefix}approver-two`,
          displayName: 'Stage 2 虚构二级审批人',
          passwordHash,
          roleId: adminRole.id,
        },
        {
          id: ids.outsider,
          username: `${prefix}outsider`,
          displayName: 'Stage 2 虚构范围外账号',
          passwordHash,
          roleId: departmentRole.id,
        },
        {
          id: ids.viewer,
          username: `${prefix}viewer`,
          displayName: 'Stage 2 虚构只登录账号',
          passwordHash,
          roleId: viewerRole.id,
        },
      ],
    });
    await tx.userDataScope.createMany({
      data: [
        { userId: ids.approverOne, organizationId: ids.organizationA },
        { userId: ids.outsider, organizationId: ids.organizationB },
      ],
    });

    const fixtures: FixtureInput[] = [
      {
        key: 'conversionHappy',
        name: '顾星澜',
        relationship: EmploymentRelationship.INTERN,
        employmentStatus: EmploymentStatus.NON_REGULAR,
        workArrangement: WorkArrangement.INTERN,
      },
      {
        key: 'conversionRollback',
        name: '唐知遥',
        relationship: EmploymentRelationship.INTERN,
        employmentStatus: EmploymentStatus.NON_REGULAR,
        workArrangement: WorkArrangement.INTERN,
        withEmploymentRecord: false,
      },
      {
        key: 'conversionWithdraw',
        name: '许南枝',
        relationship: EmploymentRelationship.INTERN,
        employmentStatus: EmploymentStatus.NON_REGULAR,
        workArrangement: WorkArrangement.INTERN,
      },
      {
        key: 'conversionReturn',
        name: '周清越',
        relationship: EmploymentRelationship.INTERN,
        employmentStatus: EmploymentStatus.NON_REGULAR,
        workArrangement: WorkArrangement.INTERN,
      },
      {
        key: 'conversionReject',
        name: '陆闻川',
        relationship: EmploymentRelationship.LABOR_WORKER,
        employmentStatus: EmploymentStatus.NON_REGULAR,
        workArrangement: WorkArrangement.LABOR_EMPLOYMENT,
      },
      {
        key: 'partTimeHappy',
        name: '宋予宁',
        relationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
        employmentStatus: EmploymentStatus.REGULAR,
        workArrangement: WorkArrangement.CONTRACT_EMPLOYMENT,
      },
      {
        key: 'partTimeFuture',
        name: '林望舒',
        relationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
        employmentStatus: EmploymentStatus.REGULAR,
        workArrangement: WorkArrangement.CONTRACT_EMPLOYMENT,
      },
      {
        key: 'partTimeReject',
        name: '苏见微',
        relationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
        employmentStatus: EmploymentStatus.REGULAR,
        workArrangement: WorkArrangement.CONTRACT_EMPLOYMENT,
      },
      {
        key: 'partTimeWithdraw',
        name: '沈云舟',
        relationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
        employmentStatus: EmploymentStatus.REGULAR,
        workArrangement: WorkArrangement.CONTRACT_EMPLOYMENT,
      },
      {
        key: 'partTimeReturn',
        name: '程月白',
        relationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
        employmentStatus: EmploymentStatus.REGULAR,
        workArrangement: WorkArrangement.CONTRACT_EMPLOYMENT,
      },
      {
        key: 'manager',
        name: '江砚秋',
        relationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
        employmentStatus: EmploymentStatus.REGULAR,
        workArrangement: WorkArrangement.CONTRACT_EMPLOYMENT,
      },
    ];
    for (const fixture of fixtures) await createEmploymentFixture(tx, fixture);
  }, { timeout: 60_000 });

  console.log(JSON.stringify({
    database: 'hr_personnel_demo_test',
    prefix,
    users: {
      applicant: `${prefix}applicant`,
      approverOne: `${prefix}approver-one`,
      approverTwo: `${prefix}approver-two`,
      outsider: `${prefix}outsider`,
      viewer: `${prefix}viewer`,
    },
    fixtureEmployeeNos: Object.values(employees).map((key) => `${prefix}${key.toUpperCase()}`),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
