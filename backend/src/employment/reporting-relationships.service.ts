import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AssignmentStatus,
  Prisma,
  RecordStatus,
  ReportingRelationshipType,
} from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { QueryReportingRelationshipsDto } from './dto/query-reporting-relationships.dto';

const MAX_GRAPH_NODES = 10_000;

type RootReason = 'NO_CURRENT_MANAGER' | 'EDGE_NOT_IN_SCOPE' | null;

export interface ReportingEmployeeSnapshot {
  id: string;
  employeeNo: string | null;
  name: string | null;
  organizationId: string | null;
  organizationName: string | null;
  positionName: string | null;
  canViewEmployeeDetail: boolean;
}

export interface ReportingRelationshipRow {
  id: string;
  employeeId: string;
  managerEmployeeId: string;
  employee: ReportingEmployeeSnapshot;
  manager: ReportingEmployeeSnapshot;
  relationshipType: ReportingRelationshipType;
  isPrimary: boolean;
  startDate: string | null;
  endDate: string | null;
  status: RecordStatus;
}

export interface AuthorizedEmployeeNode extends ReportingEmployeeSnapshot {
  rootReason: RootReason;
}

export interface AuthorizedRelationshipEdge {
  relationshipId: string;
  sourceEmployeeId: string;
  targetManagerEmployeeId: string;
  relationshipType: ReportingRelationshipType;
  isPrimary: boolean;
  startDate: string | null;
  endDate: string | null;
  status: RecordStatus;
}

export interface ReportingRelationshipGraph {
  nodes: AuthorizedEmployeeNode[];
  edges: AuthorizedRelationshipEdge[];
  warnings: string[];
}

export interface ReportingRelationshipsResponse {
  data: ReportingRelationshipRow[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  graph: ReportingRelationshipGraph;
}

type AssignmentSnapshot = {
  organizationId: string;
  organization: { id: string; name: string };
  position: { name: string } | null;
  jobTitle: { name: string } | null;
};

type EmployeeSnapshotRow = {
  id: string;
  employeeNo: string;
  name: string | null;
  assignments: AssignmentSnapshot[];
};

type RelationshipSnapshotRow = {
  id: string;
  employeeId: string;
  managerEmployeeId: string;
  relationshipType: ReportingRelationshipType;
  isPrimary: boolean;
  startDate: Date | null;
  endDate: Date | null;
  status: RecordStatus;
  archivedAt: Date | null;
  employee: EmployeeSnapshotRow;
  manager: EmployeeSnapshotRow;
};

@Injectable()
export class ReportingRelationshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: QueryReportingRelationshipsDto,
  ): Promise<ReportingRelationshipsResponse> {
    this.assertSupportedQuery(query);
    if (!this.access.hasPermission(user, PERMISSIONS.EMPLOYEE_READ)) {
      throw new ForbiddenException('没有汇报关系读取权限');
    }

    const businessDate = this.parseBusinessDate(query.asOf);
    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? null
      : await this.access.getAccessibleOrganizationIds(user);
    const displayedOrganizationIds = await this.resolveDisplayedOrganizationIds(
      query.organizationId,
      accessibleOrganizationIds,
    );

    if (displayedOrganizationIds && displayedOrganizationIds.length === 0) {
      return this.emptyResponse(query);
    }

    const employeeWhere = this.employeeVisibilityWhere(
      businessDate,
      displayedOrganizationIds,
    );
    const assignmentWhere = this.currentAssignmentWhere(businessDate, displayedOrganizationIds);
    const relationshipWhere = this.relationshipWhere(
      businessDate,
      displayedOrganizationIds,
      query.relationshipType,
      query.keyword,
    );

    const [employeeRows, relationshipRows] = await Promise.all([
      this.prisma.employee.findMany({
        where: employeeWhere,
        select: this.employeeSelect(assignmentWhere),
        orderBy: [{ employeeNo: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.reportingRelationship.findMany({
        where: relationshipWhere,
        select: this.relationshipSelect(assignmentWhere),
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      }),
    ]);

    const visibleEmployeeIds = new Set(employeeRows.map((row) => row.id));
    const visibleRows = (relationshipRows as unknown as RelationshipSnapshotRow[])
      .filter((row) => this.isCurrentPrimaryRelationship(row, businessDate))
      .filter((row) => visibleEmployeeIds.has(row.employeeId))
      .filter((row) => this.matchesKeyword(row, query.keyword, visibleEmployeeIds))
      .sort((left, right) => this.compareRelationships(left, right));
    const detailEmployeeIds = await this.resolveCurrentDetailEmployeeIds(
      user,
      visibleEmployeeIds,
      hasAllEmployeeData,
    );

    const { rows, graph, warnings } = this.sanitizeRelationships(
      visibleRows,
      employeeRows as unknown as EmployeeSnapshotRow[],
      visibleEmployeeIds,
      detailEmployeeIds,
    );

    if (query.view === 'graph' && graph.nodes.length > MAX_GRAPH_NODES) {
      throw new ConflictException('关系图数据量超过安全上限，请缩小筛选范围后重试');
    }

    const completeGraph = { ...graph, warnings };
    if (query.view === 'graph') {
      return {
        data: rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          totalPages: rows.length > 0 ? 1 : 0,
        },
        graph: completeGraph,
      };
    }

    const start = (query.page - 1) * query.pageSize;
    const pageRows = rows.slice(start, start + query.pageSize);
    return {
      data: pageRows,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: rows.length,
        totalPages: Math.ceil(rows.length / query.pageSize),
      },
      graph: completeGraph,
    };
  }

  private assertSupportedQuery(query: QueryReportingRelationshipsDto) {
    if (query.isPrimary === false) {
      throw new BadRequestException('P0 仅支持主要汇报关系');
    }
    if (query.includeDotted) {
      throw new BadRequestException('虚线汇报关系规则尚未确认');
    }
  }

  private parseBusinessDate(value?: string) {
    if (value !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('业务日期必须为 YYYY-MM-DD');
    }
    const date = value ? new Date(`${value}T00:00:00.000Z`) : this.utcCalendarDay();
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== (value ?? date.toISOString().slice(0, 10))) {
      throw new BadRequestException('业务日期无效');
    }
    return date;
  }

  private utcCalendarDay(value = new Date()) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private async resolveDisplayedOrganizationIds(
    requestedOrganizationId: string | undefined,
    accessibleOrganizationIds: string[] | null,
  ): Promise<string[] | null> {
    if (!requestedOrganizationId) return accessibleOrganizationIds;
    return this.access.getOrganizationSubtreeIds(
      requestedOrganizationId,
      accessibleOrganizationIds ?? undefined,
    );
  }

  private async resolveCurrentDetailEmployeeIds(
    user: AuthenticatedUser,
    visibleEmployeeIds: Set<string>,
    hasAllEmployeeData: boolean,
  ) {
    if (visibleEmployeeIds.size === 0) return new Set<string>();
    if (hasAllEmployeeData) return new Set(visibleEmployeeIds);

    const detailWhere = await this.access.getEmployeeWhere(
      user,
      undefined,
      this.utcCalendarDay(),
    );
    const rows = await this.prisma.employee.findMany({
      where: { id: { in: [...visibleEmployeeIds] }, ...detailWhere },
      select: { id: true },
    });
    return new Set(rows.map(({ id }) => id));
  }

  private currentAssignmentWhere(
    businessDate: Date,
    organizationIds: string[] | null,
  ): Prisma.EmployeeAssignmentWhereInput {
    return {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      isPrimary: true,
      startDate: { lte: businessDate },
      OR: [{ endDate: null }, { endDate: { gte: businessDate } }],
      ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
    };
  }

  private employeeVisibilityWhere(
    businessDate: Date,
    organizationIds: string[] | null,
  ): Prisma.EmployeeWhereInput {
    return {
      recordStatus: RecordStatus.ACTIVE,
      archivedAt: null,
      ...(organizationIds
        ? { assignments: { some: this.currentAssignmentWhere(businessDate, organizationIds) } }
        : {}),
    };
  }

  private relationshipWhere(
    businessDate: Date,
    organizationIds: string[] | null,
    relationshipType: ReportingRelationshipType | undefined,
    keyword: string | undefined,
  ): Prisma.ReportingRelationshipWhereInput {
    const conditions: Prisma.ReportingRelationshipWhereInput[] = [
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { isPrimary: true },
      { startDate: { lte: businessDate } },
      { OR: [{ endDate: null }, { endDate: { gte: businessDate } }] },
      {
        employee: {
          is: {
            recordStatus: RecordStatus.ACTIVE,
            archivedAt: null,
            ...(organizationIds
              ? { assignments: { some: this.currentAssignmentWhere(businessDate, organizationIds) } }
              : {}),
          },
        },
      },
      {
        manager: {
          is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null },
        },
      },
    ];
    if (relationshipType) conditions.push({ relationshipType });
    if (keyword) {
      conditions.push({
        OR: [
          { employee: { is: { OR: [{ employeeNo: { contains: keyword } }, { name: { contains: keyword } }] } } },
          { manager: { is: { OR: [{ employeeNo: { contains: keyword } }, { name: { contains: keyword } }] } } },
        ],
      });
    }
    return { AND: conditions };
  }

  private employeeSelect(assignmentWhere: Prisma.EmployeeAssignmentWhereInput) {
    return {
      id: true,
      employeeNo: true,
      name: true,
      assignments: {
        where: assignmentWhere,
        orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { id: 'asc' }],
        take: 1,
        select: {
          organizationId: true,
          organization: { select: { id: true, name: true } },
          position: { select: { name: true } },
          jobTitle: { select: { name: true } },
        },
      },
    } satisfies Prisma.EmployeeSelect;
  }

  private relationshipSelect(assignmentWhere: Prisma.EmployeeAssignmentWhereInput) {
    const employee = this.employeeSelect(assignmentWhere);
    return {
      id: true,
      employeeId: true,
      managerEmployeeId: true,
      relationshipType: true,
      isPrimary: true,
      startDate: true,
      endDate: true,
      status: true,
      archivedAt: true,
      employee: { select: employee },
      manager: { select: employee },
    } satisfies Prisma.ReportingRelationshipSelect;
  }

  private isCurrentPrimaryRelationship(row: RelationshipSnapshotRow, businessDate: Date) {
    return row.status === RecordStatus.ACTIVE
      && row.archivedAt === null
      && row.isPrimary
      && (row.startDate === null || row.startDate <= businessDate)
      && (row.endDate === null || row.endDate >= businessDate);
  }

  private matchesKeyword(
    row: RelationshipSnapshotRow,
    keyword: string | undefined,
    visibleEmployeeIds: Set<string>,
  ) {
    if (!keyword) return true;
    const lowerKeyword = keyword.toLocaleLowerCase();
    const employeeMatches = visibleEmployeeIds.has(row.employee.id)
      && [row.employee.employeeNo, row.employee.name]
        .some((value) => value?.toLocaleLowerCase().includes(lowerKeyword));
    const managerMatches = visibleEmployeeIds.has(row.manager.id)
      && [row.manager.employeeNo, row.manager.name]
        .some((value) => value?.toLocaleLowerCase().includes(lowerKeyword));
    return employeeMatches || managerMatches;
  }

  private hasVisibleManager(row: RelationshipSnapshotRow, visibleEmployeeIds: Set<string>) {
    return visibleEmployeeIds.has(row.managerEmployeeId)
      && row.manager.id === row.managerEmployeeId;
  }

  private compareRelationships(left: RelationshipSnapshotRow, right: RelationshipSnapshotRow) {
    const leftDate = left.startDate?.getTime() ?? Number.NEGATIVE_INFINITY;
    const rightDate = right.startDate?.getTime() ?? Number.NEGATIVE_INFINITY;
    return rightDate - leftDate || left.id.localeCompare(right.id);
  }

  private sanitizeRelationships(
    rawRows: RelationshipSnapshotRow[],
    employeeRows: EmployeeSnapshotRow[],
    visibleEmployeeIds: Set<string>,
    detailEmployeeIds: Set<string>,
  ) {
    const warnings: string[] = [];
    const warn = (message: string) => {
      if (!warnings.includes(message)) warnings.push(message);
    };
    const employeeState = new Map<string, 'NO_CURRENT_MANAGER' | 'EDGE_NOT_IN_SCOPE' | 'HAS_RELATION'>();
    employeeRows.forEach((employee) => employeeState.set(employee.id, 'NO_CURRENT_MANAGER'));
    rawRows.forEach((row) => {
      if (!visibleEmployeeIds.has(row.managerEmployeeId)) {
        employeeState.set(row.employeeId, 'EDGE_NOT_IN_SCOPE');
      } else if (employeeState.get(row.employeeId) !== 'EDGE_NOT_IN_SCOPE') {
        employeeState.set(row.employeeId, 'HAS_RELATION');
      }
    });

    const nonSelfRows = rawRows.filter((row) => {
      if (row.employeeId !== row.managerEmployeeId) return true;
      warn('检测到自环汇报关系，已排除异常边');
      return false;
    });

    const rowsByEmployee = new Map<string, RelationshipSnapshotRow[]>();
    nonSelfRows.forEach((row) => {
      const current = rowsByEmployee.get(row.employeeId) ?? [];
      current.push(row);
      rowsByEmployee.set(row.employeeId, current);
    });
    const ambiguousEmployeeIds = new Set<string>();
    rowsByEmployee.forEach((rows, employeeId) => {
      if (rows.length <= 1) return;
      ambiguousEmployeeIds.add(employeeId);
      warn('检测到同一员工同一业务日存在多个主要关系，已排除异常边');
    });
    const uniqueRows = nonSelfRows
      .filter((row) => !ambiguousEmployeeIds.has(row.employeeId))
      .filter((row) => visibleEmployeeIds.has(row.managerEmployeeId));

    const adjacency = new Map<string, string[]>();
    uniqueRows.forEach((row) => {
      const managers = adjacency.get(row.employeeId) ?? [];
      managers.push(row.managerEmployeeId);
      adjacency.set(row.employeeId, managers);
    });
    const hasPath = (start: string, target: string) => {
      const pending = [start];
      const visited = new Set<string>();
      while (pending.length > 0) {
        const current = pending.pop();
        if (!current || visited.has(current)) continue;
        if (current === target) return true;
        visited.add(current);
        pending.push(...(adjacency.get(current) ?? []));
      }
      return false;
    };
    const safeRows = uniqueRows.filter((row) => {
      if (!hasPath(row.managerEmployeeId, row.employeeId)) return true;
      warn('检测到循环汇报关系，已排除异常边');
      return false;
    });

    const rows = safeRows
      .filter((row) => visibleEmployeeIds.has(row.managerEmployeeId))
      .map((row) => this.presentRelationship(row, detailEmployeeIds));
    const safeEmployeeIds = new Set(safeRows.flatMap((row) => [row.employeeId, row.managerEmployeeId]));
    const nodes = employeeRows
      .filter((employee) => visibleEmployeeIds.has(employee.id))
      .map((employee) => {
        const state = employeeState.get(employee.id);
        return {
          ...this.presentEmployee(employee, detailEmployeeIds.has(employee.id)),
          rootReason: state === 'NO_CURRENT_MANAGER'
            ? 'NO_CURRENT_MANAGER'
            : state === 'EDGE_NOT_IN_SCOPE'
              ? 'EDGE_NOT_IN_SCOPE'
              : safeEmployeeIds.has(employee.id) && safeRows.some((row) => row.employeeId === employee.id)
                ? null
                : null,
        } satisfies AuthorizedEmployeeNode;
      });
    const edges = safeRows
      .filter((row) => visibleEmployeeIds.has(row.managerEmployeeId))
      .map((row) => ({
      relationshipId: row.id,
      sourceEmployeeId: row.employeeId,
      targetManagerEmployeeId: row.managerEmployeeId,
      relationshipType: row.relationshipType,
      isPrimary: row.isPrimary,
      startDate: this.dateString(row.startDate),
      endDate: this.dateString(row.endDate),
      status: row.status,
    } satisfies AuthorizedRelationshipEdge));

    return {
      rows,
      graph: { nodes, edges, warnings },
      warnings,
    };
  }

  private presentRelationship(
    row: RelationshipSnapshotRow,
    visibleEmployeeIds: Set<string>,
  ): ReportingRelationshipRow {
    return {
      id: row.id,
      employeeId: row.employeeId,
      managerEmployeeId: row.managerEmployeeId,
      employee: this.presentEmployee(row.employee, visibleEmployeeIds.has(row.employeeId)),
      manager: this.presentEmployee(row.manager, visibleEmployeeIds.has(row.managerEmployeeId)),
      relationshipType: row.relationshipType,
      isPrimary: row.isPrimary,
      startDate: this.dateString(row.startDate),
      endDate: this.dateString(row.endDate),
      status: row.status,
    };
  }

  private presentEmployee(row: EmployeeSnapshotRow, canViewEmployeeDetail: boolean): ReportingEmployeeSnapshot {
    const assignment = row.assignments?.[0];
    return {
      id: row.id,
      employeeNo: canViewEmployeeDetail ? row.employeeNo : null,
      name: canViewEmployeeDetail ? row.name : null,
      organizationId: canViewEmployeeDetail ? assignment?.organizationId ?? null : null,
      organizationName: canViewEmployeeDetail ? assignment?.organization.name ?? null : null,
      positionName: canViewEmployeeDetail
        ? assignment?.position?.name ?? assignment?.jobTitle?.name ?? null
        : null,
      canViewEmployeeDetail,
    };
  }

  private dateString(value: Date | null) {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private emptyResponse(query: QueryReportingRelationshipsDto): ReportingRelationshipsResponse {
    return {
      data: [],
      meta: {
        page: query.view === 'graph' ? 1 : query.page,
        pageSize: query.view === 'graph' ? 0 : query.pageSize,
        total: 0,
        totalPages: 0,
      },
      graph: { nodes: [], edges: [], warnings: [] },
    };
  }
}
