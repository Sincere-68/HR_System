import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentStatus, Prisma, RecordStatus } from '@prisma/client';
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

  async getAccessibleOrganizationIds(user: AuthenticatedUser): Promise<string[] | null> {
    if (this.hasAllEmployeeData(user)) return null;

    const organizations = this.demo.enabled
      ? this.demo.getOrganizations().map(({ id, parentId }) => ({ id, parentId }))
      : await this.prisma.organization.findMany({ select: { id: true, parentId: true } });
    const accessible = new Set(user.organizationIds);
    const pending = [...user.organizationIds];
    const childrenByParent = new Map<string, string[]>();
    for (const organization of organizations) {
      if (!organization.parentId) continue;
      const children = childrenByParent.get(organization.parentId) ?? [];
      children.push(organization.id);
      childrenByParent.set(organization.parentId, children);
    }

    while (pending.length > 0) {
      const parentId = pending.shift();
      if (!parentId) continue;
      for (const childId of childrenByParent.get(parentId) ?? []) {
        if (accessible.has(childId)) continue;
        accessible.add(childId);
        pending.push(childId);
      }
    }
    return [...accessible];
  }

  /**
   * Synchronous check retained for callers that already have a concrete
   * organization ID from a trusted, non-database context. Database-backed
   * authorization must use canAccessOrganizationInScope below.
   */
  canAccessOrganization(user: AuthenticatedUser, organizationId: string) {
    if (this.hasAllEmployeeData(user)) return true;
    if (!this.demo.enabled) return user.organizationIds.includes(organizationId);

    const organizations = this.demo.getOrganizations();
    const childrenByParent = new Map<string, string[]>();
    for (const organization of organizations) {
      if (!organization.parentId) continue;
      const children = childrenByParent.get(organization.parentId) ?? [];
      children.push(organization.id);
      childrenByParent.set(organization.parentId, children);
    }

    const accessible = new Set(user.organizationIds);
    const pending = [...user.organizationIds];
    while (pending.length > 0) {
      const parentId = pending.shift();
      if (!parentId) continue;
      for (const childId of childrenByParent.get(parentId) ?? []) {
        if (accessible.has(childId)) continue;
        accessible.add(childId);
        pending.push(childId);
      }
    }
    return accessible.has(organizationId);
  }

  async canAccessOrganizationInScope(user: AuthenticatedUser, organizationId: string) {
    if (this.hasAllEmployeeData(user)) return true;
    const accessible = await this.getAccessibleOrganizationIds(user);
    return accessible?.includes(organizationId) ?? false;
  }

  /**
   * Builds the current assignment scope. The legacy organization_id fallback
   * is deliberately limited to employees with no assignment rows at all; it
   * cannot override a migrated employee's current or historical assignments.
   */
  async getEmployeeWhere(
    user: AuthenticatedUser,
    expandedOrganizationIds?: string[],
    now = new Date(),
  ): Promise<Prisma.EmployeeWhereInput> {
    if (this.hasAllEmployeeData(user)) return {};

    const organizationIds = expandedOrganizationIds
      ?? await this.getAccessibleOrganizationIds(user)
      ?? [];
    const today = new Date(Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ));
    const currentAssignment: Prisma.EmployeeAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
      organizationId: { in: organizationIds },
    };
    return {
      OR: [
        { assignments: { some: currentAssignment } },
        { assignments: { none: {} }, organizationId: { in: organizationIds } },
      ],
    };
  }

  async getOrganizationSubtreeIds(
    rootId: string,
    allowedOrganizationIds?: string[],
  ): Promise<string[]> {
    const organizations = this.demo.enabled
      ? this.demo.getOrganizations().map(({ id, parentId }) => ({ id, parentId }))
      : await this.prisma.organization.findMany({ select: { id: true, parentId: true } });
    const allowed = allowedOrganizationIds ? new Set(allowedOrganizationIds) : null;
    if (!organizations.some((organization) => organization.id === rootId)) return [];
    if (allowed && !allowed.has(rootId)) return [];

    const childrenByParent = new Map<string, string[]>();
    for (const organization of organizations) {
      if (!organization.parentId) continue;
      const children = childrenByParent.get(organization.parentId) ?? [];
      children.push(organization.id);
      childrenByParent.set(organization.parentId, children);
    }

    const subtree = new Set([rootId]);
    const pending = [rootId];
    while (pending.length > 0) {
      const parentId = pending.shift();
      if (!parentId) continue;
      for (const childId of childrenByParent.get(parentId) ?? []) {
        if ((allowed && !allowed.has(childId)) || subtree.has(childId)) continue;
        subtree.add(childId);
        pending.push(childId);
      }
    }
    return [...subtree];
  }

  async assertOrganizationAccess(user: AuthenticatedUser, organizationId: string) {
    if (!(await this.canAccessOrganizationInScope(user, organizationId))) {
      throw new ForbiddenException('所选部门不在当前账号的数据范围内');
    }
    const exists = this.demo.enabled
      ? this.demo.organizationExists(organizationId)
      : Boolean(await this.prisma.organization.count({
        where: {
          id: organizationId,
          status: RecordStatus.ACTIVE,
          archivedAt: null,
        },
      }));
    if (!exists) throw new NotFoundException('部门不存在');
  }
}
