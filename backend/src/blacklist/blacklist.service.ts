import { Injectable } from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import type { BlacklistListItem, Paginated } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryBlacklistDto } from './dto/query-blacklist.dto';
import { presentBlacklistListItem } from './blacklist.presenter';

@Injectable()
export class BlacklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly demo: DemoDataService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: QueryBlacklistDto,
  ): Promise<Paginated<BlacklistListItem>> {
    if (this.demo.enabled) {
      return {
        data: [],
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const conditions: Prisma.EmployeeBlacklistRecordWhereInput[] = [
      { status: RecordStatus.ACTIVE },
    ];

    if (!this.access.hasAllEmployeeData(user)) {
      const organizationIds = (await this.access.getAccessibleOrganizationIds(user)) ?? [];
      const employeeWhere = await this.access.getEmployeeWhere(user, organizationIds);
      // Records without employeeId have no enforceable organization ownership
      // in the current model and therefore remain visible only to all-data users.
      conditions.push({ employee: { is: employeeWhere } });
    }

    if (query.keyword) {
      conditions.push({
        OR: [
          { name: { contains: query.keyword } },
          { documentNumber: { contains: query.keyword } },
          { mobile: { contains: query.keyword } },
        ],
      });
    }

    const where: Prisma.EmployeeBlacklistRecordWhereInput = { AND: conditions };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeBlacklistRecord.findMany({
        where,
        orderBy: [{ effectiveDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          employee: { select: { workEmail: true } },
        },
      }),
      this.prisma.employeeBlacklistRecord.count({ where }),
    ]);

    return {
      data: rows.map((row) => presentBlacklistListItem(row)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }
}
