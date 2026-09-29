import {
  AssignmentStatus,
  EmploymentRelationship,
  EmploymentStatus,
  PrismaClient,
  RecordStatus,
  WorkArrangement,
} from '@prisma/client';

const prisma = new PrismaClient();
const smokePrefix = 'MOCK-HR-SMOKE-';
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function main() {
  if (process.env.EMPLOYMENT_SMOKE_SEED !== 'isolated-test-only') {
    throw new Error('Only isolated HR smoke seed is permitted');
  }
  const target = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/hr_personnel_demo_test') {
    throw new Error('Only local hr_personnel_demo_test is permitted');
  }

  const organizationA = await prisma.organization.findUniqueOrThrow({ where: { code: `${smokePrefix}A` } });
  const organizationB = await prisma.organization.findUniqueOrThrow({ where: { code: `${smokePrefix}B` } });
  const positionA = await prisma.position.findUniqueOrThrow({ where: { name: '模拟产品工程师岗位' } });
  const positionB = await prisma.position.findUniqueOrThrow({ where: { name: '模拟客户交付岗位' } });
  const employee = await prisma.employee.upsert({
    where: { employeeNo: `${smokePrefix}004` },
    update: { name: '林知夏', organizationId: organizationB.id, recordStatus: RecordStatus.ACTIVE, archivedAt: null },
    create: { employeeNo: `${smokePrefix}004`, name: '林知夏', organizationId: organizationB.id },
  });
  const period = await prisma.employmentPeriod.upsert({
    where: { employeeId_sequenceNo: { employeeId: employee.id, sequenceNo: 1 } },
    update: {},
    create: {
      employeeId: employee.id,
      sequenceNo: 1,
      employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
      employmentStatus: EmploymentStatus.REGULAR,
      entryDate: date('2025-01-01'),
      status: RecordStatus.ACTIVE,
    },
  });
  const assignmentHistory = [
    { organization: organizationA, position: positionA, startDate: '2025-01-01', endDate: '2026-05-31', status: AssignmentStatus.ENDED },
    { organization: organizationB, position: positionB, startDate: '2026-06-01', endDate: null, status: AssignmentStatus.ACTIVE },
  ] as const;
  for (const item of assignmentHistory) {
    const existing = await prisma.employeeAssignment.findFirst({
      where: { employeeId: employee.id, employmentPeriodId: period.id, organizationId: item.organization.id, startDate: date(item.startDate) },
    });
    if (existing) continue;
    await prisma.employeeAssignment.create({
      data: {
        employeeId: employee.id,
        employmentPeriodId: period.id,
        organizationId: item.organization.id,
        positionId: item.position.id,
        startDate: date(item.startDate),
        endDate: item.endDate ? date(item.endDate) : null,
        status: item.status,
        isPrimary: true,
        workArrangement: WorkArrangement.LABOR_EMPLOYMENT,
      },
    });
  }
  const existingStatus = await prisma.employmentRecord.findFirst({
    where: { employeeId: employee.id, employmentPeriodId: period.id, status: EmploymentStatus.REGULAR },
  });
  if (!existingStatus) {
    await prisma.employmentRecord.create({
      data: {
        employeeId: employee.id,
        employmentPeriodId: period.id,
        status: EmploymentStatus.REGULAR,
        effectiveAt: date('2025-01-01'),
        currentFlag: true,
      },
    });
  }
  console.log('Isolated history case ready:', employee.employeeNo, 'historical A, current B');
}

main().finally(() => prisma.$disconnect());
