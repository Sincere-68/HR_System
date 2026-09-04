import { PrismaClient, RecordStatus } from '@prisma/client';
import { POSITION_CATALOG } from '@hr-demo/shared';

const prisma = new PrismaClient();
const CONFIRMATION = 'UPSERT_288_UNIQUE_POSITION_NAMES';

function assertConfirmed() {
  if (process.env.CONFIRM_POSITION_CATALOG_UPSERT !== CONFIRMATION) {
    throw new Error(
      `拒绝执行：请设置 CONFIRM_POSITION_CATALOG_UPSERT=${CONFIRMATION} 后再同步职位目录。`,
    );
  }
}

async function main() {
  assertConfirmed();

  const existing = await prisma.position.findMany({
    where: { name: { in: POSITION_CATALOG.map(({ name }) => name) } },
    select: { name: true, status: true, archivedAt: true },
  });
  const existingByName = new Map(existing.map((position) => [position.name, position]));

  await prisma.$transaction(
    POSITION_CATALOG.map(({ name }) => prisma.position.upsert({
      where: { name },
      update: {
        status: RecordStatus.ACTIVE,
        archivedAt: null,
      },
      create: {
        name,
        organizationId: null,
        status: RecordStatus.ACTIVE,
      },
    })),
  );

  const created = POSITION_CATALOG.filter(({ name }) => !existingByName.has(name)).length;
  const restored = POSITION_CATALOG.filter(({ name }) => {
    const position = existingByName.get(name);
    return position?.status !== RecordStatus.ACTIVE || position.archivedAt !== null;
  }).length;
  console.log(JSON.stringify({
    positionCatalogUpsert: {
      total: POSITION_CATALOG.length,
      created,
      updated: POSITION_CATALOG.length - created,
      restored,
    },
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
