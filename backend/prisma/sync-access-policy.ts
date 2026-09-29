import { PrismaClient } from '@prisma/client';
import {
  ACCESS_CONTROL_PERMISSION_DEFINITIONS,
  ACCESS_CONTROL_ROLE_DEFINITIONS,
} from './access-policy';

const prisma = new PrismaClient();

async function main() {
  for (const { code, name } of ACCESS_CONTROL_PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  }

  for (const { code, name, permissionCodes } of ACCESS_CONTROL_ROLE_DEFINITIONS) {
    const permissions = await prisma.permission.findMany({
      where: { code: { in: [...permissionCodes] } },
      select: { id: true },
    });
    if (permissions.length !== permissionCodes.length) {
      throw new Error(`角色 ${code} 的权限目录不完整，未更新任何角色`);
    }

    await prisma.role.upsert({
      where: { code },
      update: {
        name,
        permissions: {
          deleteMany: {},
          create: permissions.map(({ id }) => ({ permissionId: id })),
        },
      },
      create: {
        code,
        name,
        permissions: {
          create: permissions.map(({ id }) => ({ permissionId: id })),
        },
      },
    });
  }

  console.log('账号角色策略已同步：管理员与 HR管理员全量可见，普通员工仅本人只读。');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
