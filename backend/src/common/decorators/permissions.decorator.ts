import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '@hr-demo/shared';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'any-permissions';

export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Allows a route when the current user holds at least one listed permission. */
export const RequireAnyPermission = (...permissions: PermissionCode[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
