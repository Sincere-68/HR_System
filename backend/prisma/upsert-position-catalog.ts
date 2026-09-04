import { PrismaClient, RecordStatus } from '@prisma/client';
import { POSITION_CATALOG } from '@hr-demo/shared';

const prisma = new PrismaClient();
const CONFIRMATION = 'UPSERT_434_POSITION_CATALOG';

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
    where: { code: { in: POSITION_CATALOG.map(({ code }) => code) } },
    select: { code: true, status: true, archivedAt: true },
  });
  const existingByCode = new Map(existing.map((position) => [position.code, position]));

  await prisma.$transaction(
    POSITION_CATALOG.map(({ code, name }) => prisma.position.upsert({
      where: { code },
      update: {
        name,
        organizationId: null,
        status: RecordStatus.ACTIVE,
        archivedAt: null,
      },
      create: {
        code,
        name,
        organizationId: null,
        status: RecordStatus.ACTIVE,
      },
    })),
  );

  const created = POSITION_CATALOG.filter(({ code }) => !existingByCode.has(code)).length;
  const restored = POSITION_CATALOG.filter(({ code }) => {
    const position = existingByCode.get(code);
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
