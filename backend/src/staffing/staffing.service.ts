import { Injectable } from '@nestjs/common';
import type { Paginated, TransferTypeListItem } from '@hr-demo/shared';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryTransferTypesDto } from './dto/query-transfer-types.dto';

@Injectable()
export class StaffingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoDataService,
  ) {}

  async findTransferTypes(
    query: QueryTransferTypesDto,
  ): Promise<Paginated<TransferTypeListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.movementType.findMany({
        select: { id: true, name: true, status: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.movementType.count(),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        displayOrder: null,
        effectiveDate: null,
        status: row.status,
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  private emptyPage(
    query: QueryTransferTypesDto,
  ): Paginated<TransferTypeListItem> {
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
}
