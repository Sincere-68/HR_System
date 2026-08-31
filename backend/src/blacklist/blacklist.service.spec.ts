import { RecordStatus } from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { BlacklistService } from './blacklist.service';

const query = { page: 1, pageSize: 10 } as never;
const scopedUser = {
  id: 'user-1',
  username: 'viewer',
  displayName: '查看者',
  role: 'VIEWER' as const,
  roleName: '查看者',
  permissions: [PERMISSIONS.EMPLOYEE_READ],
  organizationIds: ['org-a'],
};

const scopedEmployeeWhere = {
  OR: [
    {
      assignments: {
        some: expect.objectContaining({ organizationId: { in: ['org-a', 'org-child'] } }),
      },
    },
    {
      assignments: { none: {} },
      organizationId: { in: ['org-a', 'org-child'] },
    },
  ],
};

describe('BlacklistService', () => {
  it('returns an explicit empty page in demo mode without inventing records', async () => {
    const service = new BlacklistService(
      {} as never,
      {} as never,
      { enabled: true } as never,
    );

    await expect(service.findAll(scopedUser, query)).resolves.toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    });
  });

  it('loads employee work email through the same scoped relation and excludes unowned records', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      employeeBlacklistRecord: { findMany, count },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      hasAllEmployeeData: jest.fn(() => false),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a', 'org-child']),
      getEmployeeWhere: jest.fn().mockResolvedValue(scopedEmployeeWhere),
    };
    const service = new BlacklistService(prisma as never, access as never, { enabled: false } as never);

    await service.findAll(scopedUser, query);

    expect(access.getEmployeeWhere).toHaveBeenCalledWith(scopedUser, ['org-a', 'org-child']);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: expect.arrayContaining([
          { status: RecordStatus.ACTIVE },
          { employee: { is: scopedEmployeeWhere } },
        ]),
      },
      include: {
        employee: { select: { workEmail: true } },
      },
    }));
  });
});
