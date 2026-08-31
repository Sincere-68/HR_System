import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AccessControlService } from '../access-control/access-control.service';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly demo: DemoDataService,
  ) {}

  async findAll(user: AuthenticatedUser) {
    if (this.demo.enabled) {
      const organizations = this.demo.getOrganizations();
      return this.access.hasAllEmployeeData(user)
        ? organizations
        : organizations.filter((organization) => user.organizationIds.includes(organization.id));
    }

    const accessibleOrganizationIds = (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    return this.prisma.organization.findMany({
      where: this.access.hasAllEmployeeData(user)
        ? undefined
        : { id: { in: accessibleOrganizationIds } },
      select: { id: true, code: true, name: true, parentId: true },
      orderBy: [{ code: 'asc' }],
    });
  }
}
