import { PrismaClient } from '@prisma/client';
import { POSITION_CATALOG } from '@hr-demo/shared';

const prisma = new PrismaClient();
const RESET_CONFIRMATION = 'REPLACE_434_TEST_POSITIONS';

function assertResetIsConfirmed() {
  if (process.env.CONFIRM_TEST_POSITION_CATALOG_RESET !== RESET_CONFIRMATION) {
    throw new Error(
      `拒绝执行：请设置 CONFIRM_TEST_POSITION_CATALOG_RESET=${RESET_CONFIRMATION} 后再运行测试职位目录替换。`,
    );
  }
}

async function main() {
  assertResetIsConfirmed();

  const result = await prisma.$transaction(async (tx) => {
    // These tables are explicitly acknowledged test data that reference Position.
    // Delete dependents before their Position foreign keys, then recreate the catalog.
    const fieldChangeLogs = await tx.employeeFieldChangeLog.deleteMany();
    const staffingPlans = await tx.staffingPlan.deleteMany();
    const trialPostRecords = await tx.trialPostRecord.deleteMany();
    const movements = await tx.employeeMovement.deleteMany();
    const offers = await tx.offer.deleteMany();
    const assignments = await tx.employeeAssignment.deleteMany();
    const positions = await tx.position.deleteMany();
    const created = await tx.position.createMany({
      data: POSITION_CATALOG.map(({ code, name }) => ({
        code,
        name,
        organizationId: null,
        status: 'ACTIVE',
        archivedAt: null,
      })),
    });

    return {
      fieldChangeLogs: fieldChangeLogs.count,
      staffingPlans: staffingPlans.count,
      trialPostRecords: trialPostRecords.count,
      movements: movements.count,
      offers: offers.count,
      assignments: assignments.count,
      positions: positions.count,
      createdPositions: created.count,
    };
  });

  console.log(JSON.stringify({ positionCatalogReset: result }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
