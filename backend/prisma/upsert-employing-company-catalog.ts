import { PrismaClient, RecordStatus } from '@prisma/client';
import { EMPLOYING_COMPANY_CATALOG } from '@hr-demo/shared';

const prisma = new PrismaClient();
const CONFIRMATION = 'UPSERT_27_EMPLOYING_COMPANIES';

function assertConfirmed() {
  if (process.env.CONFIRM_EMPLOYING_COMPANY_CATALOG_UPSERT !== CONFIRMATION) {
    throw new Error(
      `拒绝执行：请设置 CONFIRM_EMPLOYING_COMPANY_CATALOG_UPSERT=${CONFIRMATION} 后再同步全日制公司目录。`,
    );
  }
}

async function main() {
  assertConfirmed();

  const catalogCodes = EMPLOYING_COMPANY_CATALOG.map(({ code }) => code);
  const existing = await prisma.employingCompany.findMany({
    where: { code: { in: catalogCodes } },
    select: { code: true, status: true, archivedAt: true },
  });
  const existingByCode = new Map(existing.map((company) => [company.code, company]));

  await prisma.$transaction(
    EMPLOYING_COMPANY_CATALOG.map(({ code, name, sortOrder }) => prisma.employingCompany.upsert({
      where: { code },
      update: {
        name,
        sortOrder,
        status: RecordStatus.ACTIVE,
        archivedAt: null,
      },
      create: {
        code,
        name,
        sortOrder,
        status: RecordStatus.ACTIVE,
      },
    })),
  );

  const created = EMPLOYING_COMPANY_CATALOG.filter(({ code }) => !existingByCode.has(code)).length;
  const restored = EMPLOYING_COMPANY_CATALOG.filter(({ code }) => {
    const company = existingByCode.get(code);
    return company?.status !== RecordStatus.ACTIVE || company.archivedAt !== null;
  }).length;
  console.log(JSON.stringify({
    employingCompanyCatalogUpsert: {
      total: EMPLOYING_COMPANY_CATALOG.length,
      created,
      updated: EMPLOYING_COMPANY_CATALOG.length - created,
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
