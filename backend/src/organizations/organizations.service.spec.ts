import { OrganizationsService } from './organizations.service';
import { AccessControlService } from '../access-control/access-control.service';

const admin = {
  id: 'admin', username: 'admin', displayName: '管理员', role: 'ADMIN' as const,
  roleName: '管理员', permissions: ['employee.data.all'] as never[], organizationIds: [],
};
const scopedUser = {
  id: 'user', username: 'user', displayName: '用户', role: 'DEPT_ADMIN' as const,
  roleName: '部门管理员', permissions: ['organization.read'] as never[], organizationIds: ['org-a'],
};

function createService(demoEnabled: boolean) {
  const prisma = {
    organization: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const demo = {
    enabled: demoEnabled,
    getOrganizations: jest.fn().mockReturnValue([
      { id: 'org-a', code: 'A', name: 'A', parentId: null },
      { id: 'org-b', code: 'B', name: 'B', parentId: 'org-a' },
      { id: 'org-c', code: 'C', name: 'C', parentId: 'org-b' },
      { id: 'org-archived', code: 'OLD', name: '旧组织', parentId: null },
    ]),
  };
  const access = new AccessControlService(prisma as never, demo as never);
  return { service: new OrganizationsService(prisma as never, access, demo as never), prisma, demo };
}

describe('OrganizationsService', () => {
  it('returns all demo organizations for administrators', async () => {
    const { service } = createService(true);
    await expect(service.findAll(admin)).resolves.toHaveLength(4);
  });

  it('expands scoped demo organizations through every descendant level', async () => {
    const { service } = createService(true);
    await expect(service.findAll(scopedUser)).resolves.toEqual([
      { id: 'org-a', code: 'A', name: 'A', parentId: null },
      { id: 'org-b', code: 'B', name: 'B', parentId: 'org-a' },
      { id: 'org-c', code: 'C', name: 'C', parentId: 'org-b' },
    ]);
  });

  it('filters archived organizations in the database query', async () => {
    const { service, prisma } = createService(false);
    await service.findAll(admin);
    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', archivedAt: null },
      select: { id: true, code: true, name: true, parentId: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }, { id: 'asc' }],
    });
  });
});
