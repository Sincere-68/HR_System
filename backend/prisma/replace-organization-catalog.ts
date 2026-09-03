import { PrismaClient, RecordStatus } from '@prisma/client';
import { ORGANIZATION_CATALOG } from '@hr-demo/shared';

const prisma = new PrismaClient();
const RESET_CONFIRMATION = 'REPLACE_44_TEST_ORGANIZATIONS';

function assertResetIsConfirmed() {
  if (process.env.CONFIRM_TEST_ORGANIZATION_CATALOG_RESET !== RESET_CONFIRMATION) {
    throw new Error(
      `拒绝执行：请设置 CONFIRM_TEST_ORGANIZATION_CATALOG_RESET=${RESET_CONFIRMATION} 后再运行测试组织目录替换。`,
    );
  }
}

async function main() {
  assertResetIsConfirmed();

  const result = await prisma.$transaction(async (tx) => {
    const organizationsByCode = new Map<string, { id: string }>();
    for (const entry of ORGANIZATION_CATALOG) {
      const id = `organization-${entry.code.toLocaleLowerCase()}`;
      const parentId = entry.parentCode
        ? organizationsByCode.get(entry.parentCode)?.id
        : null;
      if (entry.parentCode && !parentId) {
        throw new Error(`组织目录父节点未先创建：${entry.parentCode}`);
      }
      const organization = await tx.organization.upsert({
        where: { code: entry.code },
        update: {
          name: entry.name,
          parentId,
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
          parentId,
          sortOrder: entry.sortOrder,
          status: RecordStatus.ACTIVE,
        },
        select: { id: true },
      });
      organizationsByCode.set(entry.code, organization);
    }

    const legacyOrganizations = await tx.organization.findMany({
      where: { code: { notIn: ORGANIZATION_CATALOG.map(({ code }) => code) } },
      select: { id: true },
    });
    const legacyOrganizationIds = legacyOrganizations.map(({ id }) => id);
    const rootId = organizationsByCode.get('COMPANY_SHANGHAI_YIXIN')!.id;

    let deletedAssignments = 0;
    let deletedStaffingPlans = 0;
    let deletedLegacyOrganizations = 0;
    if (legacyOrganizationIds.length > 0) {
      const legacyAssignments = await tx.employeeAssignment.findMany({
        where: { organizationId: { in: legacyOrganizationIds } },
        select: { id: true },
      });
      if (legacyAssignments.length > 0) {
        await tx.employeeFieldChangeLog.deleteMany({
          where: { assignmentId: { in: legacyAssignments.map(({ id }) => id) } },
        });
        const deleted = await tx.employeeAssignment.deleteMany({
          where: { id: { in: legacyAssignments.map(({ id }) => id) } },
        });
        deletedAssignments = deleted.count;
      }

      await tx.userDataScope.deleteMany({ where: { organizationId: { in: legacyOrganizationIds } } });
      await tx.employee.updateMany({
        where: { organizationId: { in: legacyOrganizationIds } },
        data: { organizationId: rootId },
      });
      await tx.position.updateMany({
        where: { organizationId: { in: legacyOrganizationIds } },
        data: { organizationId: null },
      });
      await tx.jobTitle.updateMany({
        where: { organizationId: { in: legacyOrganizationIds } },
        data: { organizationId: null },
      });
      await tx.offer.updateMany({
        where: { organizationId: { in: legacyOrganizationIds } },
        data: { organizationId: null },
      });
      await tx.employeeMovement.updateMany({
        where: {
          OR: [
            { fromOrganizationId: { in: legacyOrganizationIds } },
            { toOrganizationId: { in: legacyOrganizationIds } },
          ],
        },
        data: { fromOrganizationId: null, toOrganizationId: null },
      });
      const deletedPlans = await tx.staffingPlan.deleteMany({
        where: { organizationId: { in: legacyOrganizationIds } },
      });
      deletedStaffingPlans = deletedPlans.count;

      // Detach legacy nodes from one another before deleting them through the
      // self-referencing organization foreign key.
      await tx.organization.updateMany({
        where: { id: { in: legacyOrganizationIds } },
        data: { parentId: null },
      });
      // Prisma deleteMany does not guarantee child-first order. Remove each
      // legacy root after all of its children have been detached so MySQL's
      // self-referencing organization_id foreign key cannot block the reset.
      for (const organizationId of legacyOrganizationIds) {
        const deleted = await tx.organization.deleteMany({ where: { id: organizationId } });
        deletedLegacyOrganizations += deleted.count;
      }
    }

    return {
      activeCatalogOrganizations: ORGANIZATION_CATALOG.length,
      deletedLegacyOrganizations,
      deletedAssignments,
      deletedStaffingPlans,
    };
  });

  console.log(JSON.stringify({ organizationCatalogReset: result }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
