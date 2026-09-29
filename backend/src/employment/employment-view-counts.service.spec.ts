import 'reflect-metadata';
import { BadRequestException, ForbiddenException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS } from '@hr-demo/shared';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { EmploymentViewCountsController } from './employment-view-counts.controller';
import {
  EMPLOYMENT_VIEW_COUNT_KEYS,
  EmploymentViewCountsService,
} from './employment-view-counts.service';
import { QueryEmploymentViewCountsDto } from './dto/query-employment-view-counts.dto';

const user = {
  id: 'user-1',
  username: 'hr-reader',
  displayName: '虚构读取者',
  role: 'DEPT_ADMIN' as const,
  roleName: '部门管理员',
  permissions: [PERMISSIONS.EMPLOYEE_READ] as never,
  organizationIds: ['org-root'],
};

function createService() {
  const count = (value: number) => jest.fn().mockResolvedValue(value);
  const prisma = {
    probationRecord: { count: count(11) },
    employeeAssignment: { count: count(7) },
    employmentPeriod: { count: count(5) },
    employmentConversion: { count: count(13) },
    partTimeRecord: { count: count(17) },
    employeeMovement: { count: count(3) },
    trialPostRecord: { count: count(2) },
    terminationRecord: { count: count(4) },
    retirementRecord: { count: count(6) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const access = {
    hasPermission: jest.fn(() => true),
    hasAllEmployeeData: jest.fn(() => false),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-root', 'org-child']),
    getOrganizationSubtreeIds: jest.fn().mockResolvedValue(['org-child']),
  };
  return {
    service: new EmploymentViewCountsService(prisma as never, access as never),
    prisma,
    access,
  };
}

function createCrossDepartmentProbationService(
  authorizedOrganizationId: string,
  historicalOrganizationId: string,
) {
  const probationCount = jest.fn(async ({ where }: { where: { AND?: unknown[] } }) => {
    const hasListVisibleIds = (where.AND ?? []).some((condition) => {
      if (!condition || typeof condition !== 'object') return false;
      const idFilter = (condition as { id?: { in?: string[] } }).id;
      return Array.isArray(idFilter?.in);
    });
    return hasListVisibleIds ? 0 : 1;
  });
  const rawQuery = jest.fn().mockResolvedValue([]);
  const prisma = {
    probationRecord: { count: probationCount },
    employeeAssignment: { count: jest.fn().mockResolvedValue(0) },
    employmentPeriod: { count: jest.fn().mockResolvedValue(0) },
    employmentConversion: { count: jest.fn().mockResolvedValue(0) },
    partTimeRecord: { count: jest.fn().mockResolvedValue(0) },
    $queryRaw: rawQuery,
  };
  const access = {
    hasPermission: jest.fn(() => true),
    hasAllEmployeeData: jest.fn(() => false),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue([authorizedOrganizationId]),
    getOrganizationSubtreeIds: jest.fn().mockResolvedValue([authorizedOrganizationId]),
  };
  return {
    service: new EmploymentViewCountsService(prisma as never, access as never),
    prisma,
    access,
    rawQuery,
    authorizedOrganizationId,
    historicalOrganizationId,
  };
}

function probationItems(result: Awaited<ReturnType<EmploymentViewCountsService['getViewCounts']>>) {
  return result.items.filter(({ key }) => key.startsWith('probation.'));
}

function expectStartDateScopedProbationSql(rawQuery: jest.Mock, organizationId: string) {
  const query = rawQuery.mock.calls[0]?.[0] as {
    strings?: readonly string[];
    values?: readonly unknown[];
  } | undefined;
  expect(query?.strings?.join(' ')).toContain('assignment.start_date <= probation.start_date');
  expect(query?.strings?.join(' ')).toContain('assignment.end_date >= probation.start_date');
  expect(query?.strings?.join(' ')).toContain('::"AssignmentStatus"');
  expect(query?.values).toContain(organizationId);
}

describe('EmploymentViewCountsService', () => {
  it('returns every registered key and keeps supported zero distinct from unsupported null', async () => {
    const { service } = createService();

    const result = await service.getViewCounts(user, {
      businessDate: '2026-09-18',
      organizationId: 'org-child',
    } as QueryEmploymentViewCountsDto);

    expect(EMPLOYMENT_VIEW_COUNT_KEYS).toHaveLength(38);
    expect(result.businessDate).toBe('2026-09-18');
    expect(result.scope).toEqual({
      organizationId: 'org-child',
      organizationMode: 'AUTHORIZED_SUBTREE',
    });
    expect(result.items).toHaveLength(38);
    expect(result.items.map(({ key }) => key)).toEqual([...EMPLOYMENT_VIEW_COUNT_KEYS]);

    expect(result.items.find(({ key }) => key === 'records.current')).toEqual(expect.objectContaining({
      key: 'records.current',
      supported: true,
      count: 7,
      reason: null,
    }));
    expect(result.items.find(({ key }) => key === 'interns.conversion_pending')).toEqual(expect.objectContaining({
      key: 'interns.conversion_pending',
      supported: true,
      count: 13,
      reason: null,
    }));
    expect(result.items.find(({ key }) => key === 'part-time.approval')).toEqual(expect.objectContaining({
      key: 'part-time.approval',
      supported: true,
      count: 17,
      reason: null,
    }));
  });

  it('uses the selected authorized subtree and business date in supported count queries', async () => {
    const { service, access, prisma } = createService();

    await service.getViewCounts(user, {
      businessDate: '2026-09-18',
      organizationId: 'org-child',
    } as QueryEmploymentViewCountsDto);

    expect(access.getAccessibleOrganizationIds).toHaveBeenCalledWith(user);
    expect(access.getOrganizationSubtreeIds).toHaveBeenCalledWith(
      'org-child',
      ['org-root', 'org-child'],
    );
    expect(prisma.employeeAssignment.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            organizationId: { in: ['org-child'] },
            startDate: { lte: new Date('2026-09-18T00:00:00.000Z') },
          }),
        ]),
      }),
    }));
  });

  it('does not build an empty organization IN clause for an empty authorized scope', async () => {
    const { service, prisma, access } = createService();
    access.getAccessibleOrganizationIds.mockResolvedValue([]);
    prisma.probationRecord.count.mockImplementation(async ({ where }: { where: { AND?: unknown[] } }) => {
      const hasEmptyVisibleIds = (where.AND ?? []).some((condition) => (
        typeof condition === 'object'
          && condition !== null
          && JSON.stringify(condition) === JSON.stringify({ id: { in: [] } })
      ));
      return hasEmptyVisibleIds ? 0 : 11;
    });

    const result = await service.getViewCounts(user, {
      businessDate: '2026-09-18',
    } as QueryEmploymentViewCountsDto);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(probationItems(result).every(({ count }) => count === 0)).toBe(true);
  });

  it('matches probation list authorization when current assignment is A but probation start assignment is historical B', async () => {
    const { service, prisma, rawQuery } = createCrossDepartmentProbationService('org-a', 'org-b');

    // The employee moved from B to A after the probation started. The list's
    // effective assignment check therefore excludes this record from A.
    const result = await service.getViewCounts(user, {
      businessDate: '2026-09-18',
      organizationId: 'org-a',
    } as QueryEmploymentViewCountsDto);

    expect(rawQuery).toHaveBeenCalled();
    expectStartDateScopedProbationSql(rawQuery, 'org-a');
    expect(probationItems(result)).toEqual(expect.arrayContaining([
      expect.objectContaining({ supported: true, count: 0 }),
    ]));
    expect(probationItems(result).every(({ count }) => count === 0)).toBe(true);
    expect(prisma.probationRecord.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { id: { in: [] } },
        ]),
      }),
    }));
  });

  it('matches probation list authorization when current assignment is B but probation start assignment is historical A', async () => {
    const { service, prisma, rawQuery } = createCrossDepartmentProbationService('org-b', 'org-a');

    // This is the reverse transition: the current B scope must not count a
    // probation row whose start-date assignment was in historical A.
    const result = await service.getViewCounts(user, {
      businessDate: '2026-09-18',
      organizationId: 'org-b',
    } as QueryEmploymentViewCountsDto);

    expect(rawQuery).toHaveBeenCalled();
    expectStartDateScopedProbationSql(rawQuery, 'org-b');
    expect(probationItems(result).every(({ count }) => count === 0)).toBe(true);
    expect(prisma.probationRecord.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { id: { in: [] } },
        ]),
      }),
    }));
  });

  it('rejects an invalid calendar date instead of silently normalizing it', async () => {
    const { service } = createService();

    await expect(service.getViewCounts(user, {
      businessDate: '2026-02-30',
    } as QueryEmploymentViewCountsDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a caller without employee.read before querying data', async () => {
    const { service, access, prisma } = createService();
    access.hasPermission.mockReturnValue(false);

    await expect(service.getViewCounts(user, new QueryEmploymentViewCountsDto()))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('counts conversion queues and all six part-time views from authoritative records', async () => {
    const { service, prisma, access } = createService();
    access.hasAllEmployeeData.mockReturnValue(false);
    (prisma as any).employmentConversion = {
      count: jest.fn().mockResolvedValue(13),
    };
    (prisma as any).partTimeRecord = {
      count: jest.fn().mockResolvedValue(17),
    };

    const result = await service.getViewCounts(user, {
      businessDate: '2026-09-18',
      organizationId: 'org-child',
    } as QueryEmploymentViewCountsDto);

    for (const key of [
      'interns.conversion_pending',
      'interns.converted',
      'labor.conversion_pending',
      'labor.converted',
      'part-time.active',
      'part-time.expiring',
      'part-time.not_started',
      'part-time.ended',
      'part-time.all',
      'part-time.approval',
    ] as const) {
      expect(result.items.find((item) => item.key === key)).toEqual(expect.objectContaining({
        key,
        supported: true,
        count: expect.any(Number),
        reason: null,
      }));
    }

    expect((prisma as any).employmentConversion.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        targetOrganizationId: { in: ['org-child'] },
        OR: [{
          sourceSnapshot: {
            path: ['assignment', 'organizationId'],
            equals: 'org-child',
          },
        }],
      }),
    }));
    expect((prisma as any).partTimeRecord.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: { in: ['org-child'] },
        employee: expect.objectContaining({ is: expect.any(Object) }),
      }),
    }));
  });

  it('exposes the documented route and read permission', async () => {
    const service = { getViewCounts: jest.fn().mockResolvedValue({ items: [] }) };
    const controller = new EmploymentViewCountsController(service as never);
    const query = { businessDate: '2026-09-18' } as QueryEmploymentViewCountsDto;

    expect(Reflect.getMetadata(PATH_METADATA, EmploymentViewCountsController)).toBe('employment');
    expect(Reflect.getMetadata(PATH_METADATA, controller.getViewCounts)).toBe('view-counts');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.getViewCounts)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.getViewCounts)).toEqual([
      PERMISSIONS.EMPLOYEE_READ,
    ]);

    await expect(controller.getViewCounts(user, query)).resolves.toEqual({ items: [] });
    expect(service.getViewCounts).toHaveBeenCalledWith(user, query);
  });
});
