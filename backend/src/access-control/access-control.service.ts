import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '@hr-demo/shared';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccessControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoDataService,
  ) {}

  hasPermission(user: AuthenticatedUser, permission: string) {
    return user.permissions.includes(permission as never);
  }

  hasAllEmployeeData(user: AuthenticatedUser) {
    return this.hasPermission(user, PERMISSIONS.EMPLOYEE_DATA_ALL);
  }

  getEmployeeWhere(user: AuthenticatedUser) {
    return this.hasAllEmployeeData(user)
      ? {}
      : { organizationId: { in: user.organizationIds } };
  }

  canAccessOrganization(user: AuthenticatedUser, organizationId: string) {
    return this.hasAllEmployeeData(user) || user.organizationIds.includes(organizationId);
  }

  async assertOrganizationAccess(user: AuthenticatedUser, organizationId: string) {
    if (!this.canAccessOrganization(user, organizationId)) {
      throw new ForbiddenException('所选部门不在当前账号的数据范围内');
    }
    const exists = this.demo.enabled
      ? this.demo.organizationExists(organizationId)
      : Boolean(await this.prisma.organization.count({ where: { id: organizationId } }));
    if (!exists) throw new NotFoundException('部门不存在');
  }
}
