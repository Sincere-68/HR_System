import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '@hr-demo/shared';
import { AccessControlService } from './access-control.service';

const prisma = { organization: { count: jest.fn() } } as never;
const demo = { enabled: false, organizationExists: jest.fn() } as never;
const service = new AccessControlService(prisma, demo);
const scopedUser = {
  id: 'user-1',
  username: 'deptadmin',
  displayName: '部门管理员',
  role: 'DEPT_ADMIN' as const,
  roleName: '部门管理员',
  permissions: [PERMISSIONS.EMPLOYEE_READ],
  organizationIds: ['org-a', 'org-b'],
};

describe('AccessControlService', () => {
  it('uses every explicitly assigned department without recursion', () => {
    expect(service.getEmployeeWhere(scopedUser)).toEqual({
      organizationId: { in: ['org-a', 'org-b'] },
    });
  });

  it('allows an administrator with the all-data permission', () => {
    const admin = {
      ...scopedUser,
      role: 'ADMIN' as const,
      permissions: [PERMISSIONS.EMPLOYEE_DATA_ALL],
      organizationIds: [],
    };
    expect(service.getEmployeeWhere(admin)).toEqual({});
    expect(service.canAccessOrganization(admin, 'any-org')).toBe(true);
  });

  it('rejects an organization outside the explicit scope', async () => {
    await expect(service.assertOrganizationAccess(scopedUser, 'org-c')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
