import {
  AssignmentStatus,
  EmploymentRelationship,
  EmploymentStatus,
  PrismaClient,
  ProcessStatus,
  RecordStatus,
  ReportingRelationshipType,
  WorkArrangement,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const mockPrefix = 'MOCK-HR-SMOKE-';
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function main() {
  if (process.env.EMPLOYMENT_SMOKE_SEED !== 'isolated-test-only') {
    throw new Error('Set EMPLOYMENT_SMOKE_SEED=isolated-test-only for the isolated smoke database');
  }
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('Smoke seed must use local PostgreSQL');
  }
  if (url.pathname !== '/hr_personnel_demo_test') {
    throw new Error('Smoke seed must target hr_personnel_demo_test');
  }

  const [permissionRead, permissionUpdate, permissionAll, permissionOrganization] = await Promise.all(
    [
      ['employee.read', '查看虚构员工'],
      ['employee.update', '修改虚构员工'],
      ['employee.data.all', '查看全部虚构员工'],
      ['organization.read', '查看虚构组织'],
    ].map(([code, name]) => prisma.permission.upsert({ where: { code }, update: { name }, create: { code, name } })),
  );
  const admin = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: { name: '本地冒烟管理员' },
    create: { code: 'ADMIN', name: '本地冒烟管理员' },
  });
  const departmentAdmin = await prisma.role.upsert({
    where: { code: 'DEPT_ADMIN' },
    update: { name: '本地冒烟部门管理员' },
    create: { code: 'DEPT_ADMIN', name: '本地冒烟部门管理员' },
  });
  for (const roleId of [admin.id, departmentAdmin.id]) {
    for (const permission of roleId === admin.id
      ? [permissionRead, permissionUpdate, permissionAll, permissionOrganization]
      : [permissionRead, permissionOrganization]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permission.id } },
        update: {},
        create: { roleId, permissionId: permission.id },
      });
    }
  }

  const organizationA = await prisma.organization.upsert({
    where: { code: `${mockPrefix}A` },
    update: { name: '云岭数科模拟产品部', status: RecordStatus.ACTIVE, archivedAt: null },
    create: { code: `${mockPrefix}A`, name: '云岭数科模拟产品部' },
  });
  const organizationB = await prisma.organization.upsert({
    where: { code: `${mockPrefix}B` },
    update: { name: '云岭数科模拟交付部', status: RecordStatus.ACTIVE, archivedAt: null },
    create: { code: `${mockPrefix}B`, name: '云岭数科模拟交付部' },
  });
  const positionA = await prisma.position.upsert({
    where: { name: '模拟产品工程师岗位' },
    update: { organizationId: organizationA.id, status: RecordStatus.ACTIVE, archivedAt: null },
    create: { name: '模拟产品工程师岗位', organizationId: organizationA.id },
  });
  const positionB = await prisma.position.upsert({
    where: { name: '模拟客户交付岗位' },
    update: { organizationId: organizationB.id, status: RecordStatus.ACTIVE, archivedAt: null },
    create: { name: '模拟客户交付岗位', organizationId: organizationB.id },
  });

  const secret = process.env.EMPLOYMENT_SMOKE_PASSWORD;
  if (!secret || secret.length < 12) throw new Error('Set EMPLOYMENT_SMOKE_PASSWORD to at least 12 characters');
  const passwordHash = await bcrypt.hash(secret, 12);
  const adminUser = await prisma.user.upsert({
    where: { username: `${mockPrefix}admin` },
    update: { roleId: admin.id, passwordHash },
    create: { username: `${mockPrefix}admin`, displayName: '模拟总部HR', passwordHash, roleId: admin.id },
  });
  const departmentUser = await prisma.user.upsert({
    where: { username: `${mockPrefix}department` },
    update: { roleId: departmentAdmin.id, passwordHash },
    create: { username: `${mockPrefix}department`, displayName: '模拟产品部HR', passwordHash, roleId: departmentAdmin.id },
  });
  await prisma.userDataScope.upsert({
    where: { userId_organizationId: { userId: departmentUser.id, organizationId: organizationA.id } },
    update: {},
    create: { userId: departmentUser.id, organizationId: organizationA.id },
  });

  const manager = await prisma.employee.upsert({
    where: { employeeNo: `${mockPrefix}001` },
    update: { name: '李知远', organizationId: organizationA.id },
    create: { employeeNo: `${mockPrefix}001`, name: '李知远', organizationId: organizationA.id },
  });
  const worker = await prisma.employee.upsert({
    where: { employeeNo: `${mockPrefix}002` },
    update: { name: '周语宁', organizationId: organizationA.id },
    create: { employeeNo: `${mockPrefix}002`, name: '周语宁', organizationId: organizationA.id },
  });
  const former = await prisma.employee.upsert({
    where: { employeeNo: `${mockPrefix}003` },
    update: { name: '陈予安', organizationId: organizationB.id },
    create: { employeeNo: `${mockPrefix}003`, name: '陈予安', organizationId: organizationB.id },
  });

  const managerPeriod = await prisma.employmentPeriod.upsert({
    where: { employeeId_sequenceNo: { employeeId: manager.id, sequenceNo: 1 } },
    update: {},
    create: { employeeId: manager.id, sequenceNo: 1, employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE, employmentStatus: EmploymentStatus.REGULAR, entryDate: date('2025-01-01') },
  });
  const workerPeriod = await prisma.employmentPeriod.upsert({
    where: { employeeId_sequenceNo: { employeeId: worker.id, sequenceNo: 1 } },
    update: {},
    create: { employeeId: worker.id, sequenceNo: 1, employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE, employmentStatus: EmploymentStatus.PROBATION, entryDate: date('2026-08-01') },
  });
  const formerPeriod = await prisma.employmentPeriod.upsert({
    where: { employeeId_sequenceNo: { employeeId: former.id, sequenceNo: 1 } },
    update: {},
    create: { employeeId: former.id, sequenceNo: 1, employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE, employmentStatus: EmploymentStatus.REGULAR, entryDate: date('2024-01-01'), actualExitDate: date('2025-12-31') },
  });

  for (const [employee, period, organization, position, begin, end, status] of [
    [manager, managerPeriod, organizationA, positionA, '2025-01-01', null, AssignmentStatus.ACTIVE],
    [worker, workerPeriod, organizationA, positionA, '2026-08-01', null, AssignmentStatus.ACTIVE],
    [former, formerPeriod, organizationB, positionB, '2024-01-01', '2025-12-31', AssignmentStatus.ENDED],
  ] as const) {
    const existing = await prisma.employeeAssignment.findFirst({ where: { employeeId: employee.id, employmentPeriodId: period.id, organizationId: organization.id, isPrimary: true } });
    if (!existing) {
      await prisma.employeeAssignment.create({ data: { employeeId: employee.id, employmentPeriodId: period.id, organizationId: organization.id, positionId: position.id, isPrimary: true, startDate: date(begin), endDate: end ? date(end) : null, status, workArrangement: WorkArrangement.LABOR_EMPLOYMENT } });
    }
  }
  const existingRelationship = await prisma.reportingRelationship.findFirst({ where: { employeeId: worker.id, managerEmployeeId: manager.id, isPrimary: true } });
  if (!existingRelationship) {
    await prisma.reportingRelationship.create({ data: { employeeId: worker.id, managerEmployeeId: manager.id, relationshipType: ReportingRelationshipType.ADMINISTRATIVE, isPrimary: true, startDate: date('2026-08-01') } });
  }
  const existingProbation = await prisma.probationRecord.findFirst({ where: { employeeId: worker.id, employmentPeriodId: workerPeriod.id } });
  if (!existingProbation) {
    await prisma.probationRecord.create({ data: { employeeId: worker.id, employmentPeriodId: workerPeriod.id, startDate: date('2026-08-01'), plannedEndDate: date('2026-10-01'), probationMonths: 2, status: ProcessStatus.DRAFT } });
  }
  for (const [employee, period, status, effectiveAt] of [
    [manager, managerPeriod, EmploymentStatus.REGULAR, '2025-01-01'],
    [worker, workerPeriod, EmploymentStatus.PROBATION, '2026-08-01'],
    [former, formerPeriod, EmploymentStatus.REGULAR, '2024-01-01'],
  ] as const) {
    const exists = await prisma.employmentRecord.findFirst({ where: { employeeId: employee.id, employmentPeriodId: period.id, status } });
    if (!exists) await prisma.employmentRecord.create({ data: { employeeId: employee.id, employmentPeriodId: period.id, status, effectiveAt: date(effectiveAt), currentFlag: employee.id !== former.id } });
  }
  console.log('Isolated HR smoke records ready:', { organizationIds: [organizationA.id, organizationB.id], employeeNos: [manager.employeeNo, worker.employeeNo, former.employeeNo], accountNames: [adminUser.username, departmentUser.username] });
}

main().finally(() => prisma.$disconnect());
