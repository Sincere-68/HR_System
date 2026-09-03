import { Injectable } from '@nestjs/common';
import { RecordStatus } from '@prisma/client';
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
      const accessibleOrganizationIds = await this.access.getAccessibleOrganizationIds(user);
      const visibleOrganizations = accessibleOrganizationIds === null
        ? organizations
        : organizations.filter(({ id }) => accessibleOrganizationIds.includes(id));
      return visibleOrganizations;
    }

    const accessibleOrganizationIds = await this.access.getAccessibleOrganizationIds(user);
    return this.prisma.organization.findMany({
      where: {
        status: RecordStatus.ACTIVE,
        archivedAt: null,
        ...(accessibleOrganizationIds === null ? {} : { id: { in: accessibleOrganizationIds } }),
      },
      select: { id: true, code: true, name: true, parentId: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }, { id: 'asc' }],
    });
  }
}
