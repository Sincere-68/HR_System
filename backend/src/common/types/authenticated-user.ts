import type { PermissionCode, RoleCode } from '@hr-demo/shared';

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  role: RoleCode;
  roleName: string;
  permissions: PermissionCode[];
  organizationIds: string[];
}
