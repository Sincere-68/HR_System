import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '@hr-demo/shared';
import { AccessControlService } from './access-control.service';

const scopedUser = {
  id: 'user-1',
  username: 'deptadmin',
  displayName: '部门管理员',
  role: 'DEPT_ADMIN' as const,
  roleName: '部门管理员',
  permissions: [PERMISSIONS.EMPLOYEE_READ],
  organizationIds: ['org-a'],
};

function createService() {
  const prisma = {
    organization: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'org-a', parentId: null },
        { id: 'org-b', parentId: 'org-a' },
        { id: 'org-c', parentId: 'org-b' },
        { id: 'org-outside', parentId: null },
      ]),
      count: jest.fn().mockResolvedValue(1),
    },
  };
  const demo = { enabled: false };
  return { service: new AccessControlService(prisma as never, demo as never), prisma };
}

describe('AccessControlService', () => {
  it('expands an assigned organization through every descendant level', async () => {
    const { service } = createService();

    await expect(service.getAccessibleOrganizationIds(scopedUser)).resolves.toEqual([
      'org-a',
      'org-b',
      'org-c',
    ]);
  });

  it('returns a selected organization subtree constrained to an allowed scope', async () => {
    const { service } = createService();

    await expect(service.getOrganizationSubtreeIds(
      'org-a',
      ['org-a', 'org-b', 'org-c'],
    )).resolves.toEqual(['org-a', 'org-b', 'org-c']);
    await expect(service.getOrganizationSubtreeIds(
      'org-b',
      ['org-a', 'org-b', 'org-c'],
    )).resolves.toEqual(['org-b', 'org-c']);
    await expect(service.getOrganizationSubtreeIds(
      'org-outside',
      ['org-a', 'org-b', 'org-c'],
    )).resolves.toEqual([]);
  });

  it('returns null for administrators with the all-data permission', async () => {
    const { service, prisma } = createService();
    const admin = {
      ...scopedUser,
      role: 'ADMIN' as const,
      permissions: [PERMISSIONS.EMPLOYEE_DATA_ALL],
      organizationIds: [],
    };

    await expect(service.getAccessibleOrganizationIds(admin)).resolves.toBeNull();
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('keeps unrelated organization branches outside the expanded scope', async () => {
    const { service } = createService();

    await expect(service.getAccessibleOrganizationIds(scopedUser)).resolves.not.toContain('org-outside');
  });

  it('uses only unarchived current assignments and only falls back for employees without any assignments', async () => {
    const { service } = createService();
    const now = new Date(2026, 7, 26, 15, 30);

    await expect(service.getEmployeeWhere(scopedUser, undefined, now)).resolves.toEqual({
      OR: [
        {
          assignments: {
            some: expect.objectContaining({
              status: 'ACTIVE',
              archivedAt: null,
              startDate: { lte: new Date('2026-08-26T00:00:00.000Z') },
              OR: [
                { endDate: null },
                { endDate: { gte: new Date('2026-08-26T00:00:00.000Z') } },
              ],
              organizationId: { in: ['org-a', 'org-b', 'org-c'] },
            }),
          },
        },
        {
          assignments: { none: {} },
          organizationId: { in: ['org-a', 'org-b', 'org-c'] },
        },
      ],
    });
  });

  it('keeps an assignment ending today accessible throughout the business day', async () => {
    const { service } = createService();

    const where = await service.getEmployeeWhere(
      scopedUser,
      ['org-a'],
      new Date(2026, 7, 26, 16, 45),
    );

    expect(where).toEqual({
      OR: [
        {
          assignments: {
            some: expect.objectContaining({
              archivedAt: null,
              startDate: { lte: new Date('2026-08-26T00:00:00.000Z') },
              OR: [
                { endDate: null },
                { endDate: { gte: new Date('2026-08-26T00:00:00.000Z') } },
              ],
            }),
          },
        },
        { assignments: { none: {} }, organizationId: { in: ['org-a'] } },
      ],
    });
  });

  it('allows an administrator with the all-data permission', async () => {
    const { service } = createService();
    const admin = {
      ...scopedUser,
      role: 'ADMIN' as const,
      permissions: [PERMISSIONS.EMPLOYEE_DATA_ALL],
      organizationIds: [],
    };

    await expect(service.getEmployeeWhere(admin)).resolves.toEqual({});
    await expect(service.canAccessOrganizationInScope(admin, 'any-org')).resolves.toBe(true);
  });

  it('rejects an organization outside the expanded scope', async () => {
    const { service } = createService();

    await expect(service.assertOrganizationAccess(scopedUser, 'org-outside')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
