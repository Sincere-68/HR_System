import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS } from '@hr-demo/shared';
import { RecordStatus, ReportingRelationshipType } from '@prisma/client';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { ReportingRelationshipsController } from './reporting-relationships.controller';
import { ReportingRelationshipsService } from './reporting-relationships.service';
import { QueryReportingRelationshipsDto } from './dto/query-reporting-relationships.dto';

type EmployeeRow = {
  id: string;
  employeeNo: string;
  name: string;
  assignments: Array<{
    organizationId: string;
    organization: { id: string; name: string };
    position: { name: string } | null;
    jobTitle: { name: string } | null;
  }>;
};

type RelationshipRow = {
  id: string;
  employeeId: string;
  managerEmployeeId: string;
  relationshipType: ReportingRelationshipType;
  isPrimary: boolean;
  startDate: Date | null;
  endDate: Date | null;
  status: RecordStatus;
  archivedAt: Date | null;
  employee: EmployeeRow;
  manager: EmployeeRow;
};

const user = {
  id: 'user-1',
  username: 'hr-reader',
  displayName: '虚构读取者',
  role: 'DEPT_ADMIN' as const,
  roleName: '部门管理员',
  permissions: [PERMISSIONS.EMPLOYEE_READ] as never,
  organizationIds: ['org-a'],
};

function assignment(organizationId = 'org-a', organizationName = '虚构部门') {
  return {
    organizationId,
    organization: { id: organizationId, name: organizationName },
    position: { name: '虚构岗位' },
    jobTitle: { name: '虚构职务' },
  };
}

function employee(id: string, employeeNo = `${id}-NO`, name = `${id}姓名`, orgId = 'org-a'): EmployeeRow {
  return {
    id,
    employeeNo,
    name,
    assignments: [assignment(orgId, orgId === 'org-a' ? '虚构部门' : '范围外部门')],
  };
}

function relationship(
  id: string,
  employeeId: string,
  managerEmployeeId: string,
  employees: Record<string, EmployeeRow>,
  overrides: Partial<RelationshipRow> = {},
): RelationshipRow {
  return {
    id,
    employeeId,
    managerEmployeeId,
    relationshipType: ReportingRelationshipType.ADMINISTRATIVE,
    isPrimary: true,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: null,
    status: RecordStatus.ACTIVE,
    archivedAt: null,
    employee: employees[employeeId]!,
    manager: employees[managerEmployeeId]!,
    ...overrides,
  };
}

function createService(
  employees: EmployeeRow[],
  relationships: RelationshipRow[],
  options: { allData?: boolean; permission?: boolean; detailEmployeeIds?: string[] } = {},
) {
  const findRelationshipMany = jest.fn().mockResolvedValue(relationships);
  const detailEmployeeIds = options.detailEmployeeIds ?? employees.map(({ id }) => id);
  const findEmployeeMany = jest.fn()
    .mockResolvedValueOnce(employees)
    .mockResolvedValueOnce(detailEmployeeIds.map((id) => ({ id })));
  const prisma = {
    reportingRelationship: { findMany: findRelationshipMany },
    employee: { findMany: findEmployeeMany },
  };
  const access = {
    hasPermission: jest.fn(() => options.permission ?? true),
    hasAllEmployeeData: jest.fn(() => options.allData ?? true),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a']),
    getOrganizationSubtreeIds: jest.fn().mockResolvedValue(['org-a']),
    getEmployeeWhere: jest.fn().mockResolvedValue({}),
  };
  return {
    service: new ReportingRelationshipsService(prisma as never, access as never),
    prisma,
    access,
    findRelationshipMany,
    findEmployeeMany,
  };
}

describe('ReportingRelationshipsService', () => {
  it('returns a complete graph while list pagination remains bounded', async () => {
    const manager = employee('manager-1', 'M-001', '虚构经理');
    const first = employee('employee-1', 'E-001', '虚构员工一');
    const second = employee('employee-2', 'E-002', '虚构员工二');
    const employees = [manager, first, second];
    const rows = [
      relationship('relationship-1', first.id, manager.id, {
        [manager.id]: manager,
        [first.id]: first,
      }),
      relationship('relationship-2', second.id, manager.id, {
        [manager.id]: manager,
        [second.id]: second,
      }),
      relationship('relationship-old', first.id, manager.id, {
        [manager.id]: manager,
        [first.id]: first,
      }, { endDate: new Date('2026-01-02T00:00:00.000Z') }),
      relationship('relationship-inactive', first.id, manager.id, {
        [manager.id]: manager,
        [first.id]: first,
      }, { status: RecordStatus.INACTIVE }),
      relationship('relationship-archived', first.id, manager.id, {
        [manager.id]: manager,
        [first.id]: first,
      }, { archivedAt: new Date('2026-01-03T00:00:00.000Z') }),
    ];
    const { service, findRelationshipMany } = createService(employees, rows);

    const result = await service.findAll(user, {
      view: 'graph',
      asOf: '2026-09-18',
      page: 1,
      pageSize: 1,
    } as QueryReportingRelationshipsDto);

    expect(result.data.map(({ id }) => id)).toEqual(['relationship-1', 'relationship-2']);
    expect(result.meta).toEqual({ page: 1, pageSize: 2, total: 2, totalPages: 1 });
    expect(result.graph?.edges.map(({ relationshipId }) => relationshipId)).toEqual([
      'relationship-1',
      'relationship-2',
    ]);
    expect(result.graph?.nodes.map(({ id }) => id).sort()).toEqual([
      'employee-1',
      'employee-2',
      'manager-1',
    ]);
    expect(findRelationshipMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: expect.arrayContaining([
          { status: RecordStatus.ACTIVE },
          { archivedAt: null },
          { isPrimary: true },
          { startDate: { lte: new Date('2026-09-18T00:00:00.000Z') } },
          { OR: [{ endDate: null }, { endDate: { gte: new Date('2026-09-18T00:00:00.000Z') } }] },
        ]),
      },
    }));
  });

  it('uses current detail scope instead of asOf visibility for detail fields', async () => {
    const employeeAtAsOf = employee('future-transfer-employee', 'F-001', '未来调入员工');
    const manager = employee('manager-1', 'M-001', '虚构经理');
    const row = relationship('relationship-future-scope', employeeAtAsOf.id, manager.id, {
      [employeeAtAsOf.id]: employeeAtAsOf,
      [manager.id]: manager,
    });
    const { service, access, findEmployeeMany } = createService(
      [employeeAtAsOf, manager],
      [row],
      { allData: false, detailEmployeeIds: [manager.id] },
    );

    const result = await service.findAll(user, {
      view: 'graph',
      asOf: '2026-09-19',
      page: 1,
      pageSize: 10,
    } as QueryReportingRelationshipsDto);

    expect(result.graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: employeeAtAsOf.id, canViewEmployeeDetail: false }),
      expect.objectContaining({ id: manager.id, canViewEmployeeDetail: true }),
    ]));
    expect(access.getEmployeeWhere).toHaveBeenCalledWith(user, undefined, expect.any(Date));
    expect(findEmployeeMany).toHaveBeenCalledTimes(2);
  });

  it('rejects duplicate primary relationships before trimming an out-of-scope manager', async () => {
    const subordinate = employee('subordinate-duplicate', 'S-002', '重复关系下属');
    const inScopeManager = employee('manager-in-scope', 'M-002', '范围内经理');
    const externalManager = employee('manager-out-of-scope', 'X-002', '范围外经理');
    const employees = [subordinate, inScopeManager];
    const rows = [
      relationship('relationship-in-scope', subordinate.id, inScopeManager.id, {
        [subordinate.id]: subordinate,
        [inScopeManager.id]: inScopeManager,
        [externalManager.id]: externalManager,
      }),
      relationship('relationship-out-of-scope', subordinate.id, externalManager.id, {
        [subordinate.id]: subordinate,
        [inScopeManager.id]: inScopeManager,
        [externalManager.id]: externalManager,
      }),
    ];
    const { service } = createService(employees, rows, {
      allData: false,
      detailEmployeeIds: employees.map(({ id }) => id),
    });

    const result = await service.findAll(user, {
      view: 'graph',
      asOf: '2026-09-18',
      page: 1,
      pageSize: 10,
    } as QueryReportingRelationshipsDto);

    expect(result.data).toEqual([]);
    expect(result.graph.edges).toEqual([]);
    expect(result.graph.nodes).toEqual([expect.objectContaining({
      id: subordinate.id,
      rootReason: 'EDGE_NOT_IN_SCOPE',
    }), expect.objectContaining({
      id: inScopeManager.id,
      rootReason: 'NO_CURRENT_MANAGER',
    })]);
    expect(result.graph.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('主要关系'),
    ]));
    expect(JSON.stringify(result)).not.toContain(externalManager.id);
  });

  it('keeps an authorized root as a graph node without creating a null-manager row', async () => {
    const root = employee('root-1', 'R-001', '虚构根员工');
    const { service } = createService([root], []);

    const result = await service.findAll(user, {
      view: 'graph',
      asOf: '2026-09-18',
      page: 1,
      pageSize: 10,
    } as QueryReportingRelationshipsDto);

    expect(result.data).toEqual([]);
    expect(result.graph).toEqual({
      nodes: [expect.objectContaining({
        id: root.id,
        rootReason: 'NO_CURRENT_MANAGER',
      })],
      edges: [],
      warnings: [],
    });
    expect(JSON.stringify(result)).not.toContain('managerEmployeeId');
  });

  it('drops a cross-scope manager edge without exposing the manager identity', async () => {
    const subordinate = employee('subordinate-1', 'S-001', '虚构下属', 'org-a');
    const externalManager = employee('external-manager-1', 'X-001', '范围外经理', 'org-other');
    const row = relationship('relationship-cross-scope', subordinate.id, externalManager.id, {
      [subordinate.id]: subordinate,
      [externalManager.id]: externalManager,
    });
    const { service } = createService([subordinate], [row], { allData: false });

    const result = await service.findAll(user, {
      view: 'graph',
      asOf: '2026-09-18',
      page: 1,
      pageSize: 10,
    } as QueryReportingRelationshipsDto);

    expect(result.data).toEqual([]);
    expect(result.graph?.edges).toEqual([]);
    expect(result.graph?.nodes).toEqual([expect.objectContaining({
      id: subordinate.id,
      rootReason: 'EDGE_NOT_IN_SCOPE',
    })]);
    expect(JSON.stringify(result)).not.toContain(externalManager.id);
    expect(JSON.stringify(result)).not.toContain(externalManager.employeeNo);
    expect(JSON.stringify(result)).not.toContain(externalManager.name);
  });

  it('filters self-loops, cycles, and ambiguous primary rows without choosing unsafe edges', async () => {
    const ids = ['a', 'b', 'c', 'duplicate', 'manager-a', 'manager-b', 'safe', 'safe-manager'];
    const employees = ids.map((id) => employee(id, `${id}-NO`, `${id}姓名`));
    const byId = Object.fromEntries(employees.map((item) => [item.id, item]));
    const rows = [
      relationship('self-loop', 'a', 'a', byId),
      relationship('cycle-a', 'b', 'c', byId),
      relationship('cycle-b', 'c', 'b', byId),
      relationship('duplicate-a', 'duplicate', 'manager-a', byId),
      relationship('duplicate-b', 'duplicate', 'manager-b', byId),
      relationship('safe-edge', 'safe', 'safe-manager', byId),
    ];
    const { service } = createService(employees, rows);

    const result = await service.findAll(user, {
      view: 'graph',
      asOf: '2026-09-18',
      page: 1,
      pageSize: 100,
    } as QueryReportingRelationshipsDto);

    expect(result.graph?.edges).toEqual([expect.objectContaining({
      relationshipId: 'safe-edge',
      sourceEmployeeId: 'safe',
      targetManagerEmployeeId: 'safe-manager',
    })]);
    expect(result.graph?.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('自环'),
      expect.stringContaining('循环'),
      expect.stringContaining('主要关系'),
    ]));
  });

  it('requires employee.read before querying relationship data', async () => {
    const { service, findRelationshipMany, findEmployeeMany } = createService([], [], { permission: false });

    await expect(service.findAll(user, {
      view: 'list',
      page: 1,
      pageSize: 10,
    } as QueryReportingRelationshipsDto)).rejects.toMatchObject({
      status: 403,
    });
    expect(findRelationshipMany).not.toHaveBeenCalled();
    expect(findEmployeeMany).not.toHaveBeenCalled();
  });
});

describe('ReportingRelationshipsController', () => {
  it('registers and delegates the read-only endpoint', async () => {
    const service = { findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }) };
    const controller = new ReportingRelationshipsController(service as never);
    const query = { view: 'list', page: 1, pageSize: 10 } as QueryReportingRelationshipsDto;

    await expect(controller.findAll(user, query)).resolves.toEqual({ data: [], meta: {} });
    expect(service.findAll).toHaveBeenCalledWith(user, query);
    expect(Reflect.getMetadata(PATH_METADATA, ReportingRelationshipsController)).toBe('employment');
    expect(Reflect.getMetadata(PATH_METADATA, controller.findAll)).toBe('reporting-relationships');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.findAll)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.findAll)).toEqual([PERMISSIONS.EMPLOYEE_READ]);
  });
});
