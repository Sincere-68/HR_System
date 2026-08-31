import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionCode } from '@hr-demo/shared';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const anyRequired = this.reflector.getAllAndOverride<PermissionCode[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length && !anyRequired?.length) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser;
    const hasAllRequired = !required?.length || required.every((permission) => user.permissions.includes(permission));
    const hasAnyRequired = !anyRequired?.length || anyRequired.some((permission) => user.permissions.includes(permission));
    if (!hasAllRequired || !hasAnyRequired) throw new ForbiddenException('没有执行此操作的权限');
    return true;
  }
}
