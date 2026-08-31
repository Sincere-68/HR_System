import { RecordStatus } from '@prisma/client';
import { StaffingService } from './staffing.service';

function createService(rows: unknown[] = [], demoEnabled = false) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const count = jest.fn().mockResolvedValue(rows.length);
  const prisma = {
    movementType: { findMany, count },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  return {
    service: new StaffingService(prisma as never, { enabled: demoEnabled } as never),
    findMany,
    count,
  };
}

describe('StaffingService transfer types', () => {
  it('returns an empty page in demo mode without querying movement types', async () => {
    const { service, findMany, count } = createService([], true);

    await expect(service.findTransferTypes({ page: 2, pageSize: 20 })).resolves.toEqual({
      data: [],
      meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it('pages movement types and maps only fields with confirmed sources', async () => {
    const rows = [{ id: 'movement-type-1', name: '虚构部门调动', status: RecordStatus.ARCHIVED }];
    const { service, findMany, count } = createService(rows);

    const result = await service.findTransferTypes({ page: 2, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, status: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 20,
      take: 20,
    });
    expect(count).toHaveBeenCalledWith();
    expect(result).toEqual({
      data: [{
        id: 'movement-type-1',
        name: '虚构部门调动',
        displayOrder: null,
        effectiveDate: null,
        status: RecordStatus.ARCHIVED,
      }],
      meta: { page: 2, pageSize: 20, total: 1, totalPages: 1 },
    });
  });
});
