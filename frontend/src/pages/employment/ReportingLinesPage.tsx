import {
  ApartmentOutlined,
  DownOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Input, Spin, Switch, Tooltip, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import { useOrganizations } from '../../features/employees/api';
import { apiRequest } from '../../lib/api';

type ReportingLinesView = 'list' | 'graph';
type ReportingRelationshipType = 'ADMINISTRATIVE' | 'BUSINESS' | 'PROJECT' | 'FUNCTIONAL' | 'OTHER';
type ReportingRootReason = 'NO_CURRENT_MANAGER' | 'EDGE_NOT_IN_SCOPE' | null;

interface ReportingEmployeeSnapshot {
  id: string;
  employeeNo: string | null;
  name: string | null;
  organizationId: string | null;
  organizationName: string | null;
  positionName: string | null;
  canViewEmployeeDetail: boolean;
}

interface AuthorizedEmployeeNode extends ReportingEmployeeSnapshot {
  rootReason: ReportingRootReason;
}

interface AuthorizedRelationshipEdge {
  relationshipId: string;
  sourceEmployeeId: string;
  targetManagerEmployeeId: string;
  relationshipType: ReportingRelationshipType | string | null;
  isPrimary: boolean;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
}

interface ReportingRelationshipRow {
  id: string;
  employeeId: string;
  managerEmployeeId: string;
  employee: ReportingEmployeeSnapshot;
  manager: ReportingEmployeeSnapshot;
  relationshipType: ReportingRelationshipType | string | null;
  isPrimary: boolean;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
}

interface ReportingGraphPayload {
  nodes: AuthorizedEmployeeNode[];
  edges: AuthorizedRelationshipEdge[];
  warnings: string[];
}

interface ReportingRelationshipsResponse {
  data: ReportingRelationshipRow[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  graph: ReportingGraphPayload;
}

interface ReportingTreeNode extends DataNode {
  key: string;
  children?: ReportingTreeNode[];
}

export interface ReportingHierarchyNode {
  employee: AuthorizedEmployeeNode;
  children: ReportingHierarchyNode[];
  relationshipId?: string;
}

interface ReportingGraphInput {
  nodes: AuthorizedEmployeeNode[];
  edges: AuthorizedRelationshipEdge[];
}

interface RawRecord {
  [key: string]: unknown;
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): RawRecord | null {
  return isRecord(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function asInteger(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
}

function normalizeEmployeeSnapshot(value: unknown): ReportingEmployeeSnapshot | null {
  const record = asRecord(value);
  const id = asString(record?.id ?? record?.employeeId);
  if (!id) return null;

  return {
    id,
    employeeNo: asNullableString(record?.employeeNo),
    name: asNullableString(record?.name),
    organizationId: asNullableString(record?.organizationId),
    organizationName: asNullableString(record?.organizationName),
    positionName: asNullableString(record?.positionName),
    canViewEmployeeDetail: asBoolean(record?.canViewEmployeeDetail),
  };
}

function normalizeRootReason(value: unknown): ReportingRootReason {
  return value === 'NO_CURRENT_MANAGER' || value === 'EDGE_NOT_IN_SCOPE' ? value : null;
}

function normalizeGraphNode(value: unknown): AuthorizedEmployeeNode | null {
  const snapshot = normalizeEmployeeSnapshot(value);
  if (!snapshot) return null;
  const record = asRecord(value);
  return {
    ...snapshot,
    rootReason: normalizeRootReason(record?.rootReason),
  };
}

function normalizeRelationshipType(value: unknown): ReportingRelationshipType | string | null {
  return asNullableString(value);
}

function normalizeRelationshipRow(value: unknown): ReportingRelationshipRow | null {
  const record = asRecord(value);
  const id = asString(record?.id);
  const employeeId = asString(record?.employeeId);
  const managerEmployeeId = asString(record?.managerEmployeeId);
  const employee = normalizeEmployeeSnapshot(record?.employee);
  const manager = normalizeEmployeeSnapshot(record?.manager);
  if (!id || !employeeId || !managerEmployeeId || !employee || !manager) return null;

  return {
    id,
    employeeId,
    managerEmployeeId,
    employee,
    manager,
    relationshipType: normalizeRelationshipType(record?.relationshipType),
    isPrimary: asBoolean(record?.isPrimary),
    startDate: asNullableString(record?.startDate),
    endDate: asNullableString(record?.endDate),
    status: asNullableString(record?.status),
  };
}

function normalizeGraphEdge(value: unknown): AuthorizedRelationshipEdge | null {
  const record = asRecord(value);
  const relationshipId = asString(record?.relationshipId ?? record?.id);
  const sourceEmployeeId = asString(record?.sourceEmployeeId ?? record?.employeeId);
  const targetManagerEmployeeId = asString(record?.targetManagerEmployeeId ?? record?.managerEmployeeId);
  if (!relationshipId || !sourceEmployeeId || !targetManagerEmployeeId) return null;

  return {
    relationshipId,
    sourceEmployeeId,
    targetManagerEmployeeId,
    relationshipType: normalizeRelationshipType(record?.relationshipType),
    isPrimary: asBoolean(record?.isPrimary),
    startDate: asNullableString(record?.startDate),
    endDate: asNullableString(record?.endDate),
    status: asNullableString(record?.status),
  };
}

function normalizeReportingRelationshipsResponse(value: unknown): ReportingRelationshipsResponse {
  const record = asRecord(value);
  const rawData = Array.isArray(record?.data) ? record.data : [];
  const data = rawData
    .map(normalizeRelationshipRow)
    .filter((row): row is ReportingRelationshipRow => row !== null);
  const rawMeta = asRecord(record?.meta);
  const graphRecord = asRecord(record?.graph);
  const rawNodes = Array.isArray(graphRecord?.nodes) ? graphRecord.nodes : [];
  const rawEdges = Array.isArray(graphRecord?.edges) ? graphRecord.edges : [];
  const nodes = rawNodes
    .map(normalizeGraphNode)
    .filter((node): node is AuthorizedEmployeeNode => node !== null);
  const edges = rawEdges
    .map(normalizeGraphEdge)
    .filter((edge): edge is AuthorizedRelationshipEdge => edge !== null);
  const warnings = Array.isArray(graphRecord?.warnings)
    ? graphRecord.warnings.filter((warning): warning is string => typeof warning === 'string')
    : [];

  return {
    data,
    meta: {
      page: asInteger(rawMeta?.page, 1),
      pageSize: asInteger(rawMeta?.pageSize, data.length),
      total: asInteger(rawMeta?.total, data.length),
      totalPages: asInteger(rawMeta?.totalPages, data.length > 0 ? 1 : 0),
    },
    graph: { nodes, edges, warnings },
  };
}

function reportingRequestPath(query: { keyword?: string; organizationId?: string }) {
  const params = new URLSearchParams();
  // The graph response is the complete authorized node/edge set. It is also
  // the source for the tree view, so the page never treats a list page as a full graph.
  params.set('view', 'graph');
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.organizationId) params.set('organizationId', query.organizationId);
  return `/employment/reporting-relationships?${params.toString()}`;
}

interface ReportingQueryState {
  data: ReportingRelationshipsResponse | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

function useReportingRelationships(path: string): ReportingQueryState {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<Omit<ReportingQueryState, 'refetch'>>({
    data: null,
    isLoading: true,
    isFetching: true,
    isError: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({
      ...current,
      isLoading: current.data === null,
      isFetching: true,
      isError: false,
      error: null,
    }));

    apiRequest<unknown>(path)
      .then((response) => {
        if (cancelled) return;
        setState({
          data: normalizeReportingRelationshipsResponse(response),
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          isLoading: false,
          isFetching: false,
          isError: true,
          error: cause instanceof Error ? cause : new Error('汇报关系加载失败'),
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [path, reloadToken]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);
  return { ...state, refetch };
}

function isReportingLinesView(value: string | null): value is ReportingLinesView {
  return value === 'list' || value === 'graph';
}

function employeeDisplayName(employee: ReportingEmployeeSnapshot) {
  return employee.name || '--';
}

function EmployeeDetailLabel({ employee, className }: {
  employee: ReportingEmployeeSnapshot;
  className: string;
}) {
  const label = employeeDisplayName(employee);
  if (!employee.canViewEmployeeDetail) {
    return <span className={className} aria-label={`${label}（暂无详情）`}>{label}</span>;
  }
  return (
    <Link className={className} to={`/personnel/employees/${employee.id}`}>
      {label}
    </Link>
  );
}

function ReportingTreeTitle({ node }: { node: ReportingHierarchyNode }) {
  const { employee, relationshipId } = node;
  return (
    <span className="reporting-lines-tree-node">
      <EmployeeDetailLabel employee={employee} className="reporting-lines-employee-link" />
      <span className="reporting-lines-employee-meta">
        （{employee.organizationName || '--'} · {employee.employeeNo || '--'}）
      </span>
      <span className="reporting-lines-relationship-meta">
        {relationshipId ? `关系 ID：${relationshipId}` : '当前授权关系根'}
      </span>
    </span>
  );
}

function hasPath(adjacency: Map<string, string[]>, start: string, target: string) {
  const visited = new Set<string>();
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    if (current === target) return true;
    visited.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }
  return false;
}

export function buildReportingLinesHierarchy(graph: ReportingGraphInput): ReportingHierarchyNode[] {
  const nodesByEmployeeId = new Map<string, AuthorizedEmployeeNode>();
  graph.nodes.forEach((node) => {
    if (node.id) nodesByEmployeeId.set(node.id, node);
  });

  const candidateEdges = graph.edges.filter((edge) => (
    Boolean(edge.relationshipId)
      && edge.sourceEmployeeId !== edge.targetManagerEmployeeId
      && nodesByEmployeeId.has(edge.sourceEmployeeId)
      && nodesByEmployeeId.has(edge.targetManagerEmployeeId)
  ));
  const adjacency = new Map<string, string[]>();
  candidateEdges.forEach((edge) => {
    const targets = adjacency.get(edge.sourceEmployeeId) ?? [];
    targets.push(edge.targetManagerEmployeeId);
    adjacency.set(edge.sourceEmployeeId, targets);
  });

  // Remove every edge participating in a cycle, rather than leaving one half
  // of a bad cycle attached to an otherwise safe tree branch.
  const safeEdges = candidateEdges.filter((edge) => !hasPath(
    adjacency,
    edge.targetManagerEmployeeId,
    edge.sourceEmployeeId,
  ));
  const parentByEmployeeId = new Map<string, string>();
  const edgeByEmployeeId = new Map<string, AuthorizedRelationshipEdge>();
  safeEdges.forEach((edge) => {
    if (parentByEmployeeId.has(edge.sourceEmployeeId)) return;
    parentByEmployeeId.set(edge.sourceEmployeeId, edge.targetManagerEmployeeId);
    edgeByEmployeeId.set(edge.sourceEmployeeId, edge);
  });

  const childrenByManagerId = new Map<string, string[]>();
  parentByEmployeeId.forEach((managerId, employeeId) => {
    const children = childrenByManagerId.get(managerId) ?? [];
    children.push(employeeId);
    childrenByManagerId.set(managerId, children);
  });

  const buildNode = (employeeId: string, ancestors: Set<string>): ReportingHierarchyNode | null => {
    const employee = nodesByEmployeeId.get(employeeId);
    if (!employee || ancestors.has(employeeId)) return null;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(employeeId);
    const children = (childrenByManagerId.get(employeeId) ?? [])
      .map((childId) => buildNode(childId, nextAncestors))
      .filter((node): node is ReportingHierarchyNode => node !== null);
    return {
      employee,
      children,
      relationshipId: edgeByEmployeeId.get(employeeId)?.relationshipId,
    };
  };

  return Array.from(nodesByEmployeeId.keys())
    .filter((employeeId) => !parentByEmployeeId.has(employeeId))
    .map((employeeId) => buildNode(employeeId, new Set()))
    .filter((node): node is ReportingHierarchyNode => node !== null);
}

export function buildReportingLinesTree(graph: ReportingGraphInput): ReportingTreeNode[] {
  const toTreeNode = (node: ReportingHierarchyNode): ReportingTreeNode => ({
    key: node.employee.id,
    title: <ReportingTreeTitle node={node} />,
    children: node.children.map(toTreeNode),
  });

  return buildReportingLinesHierarchy(graph).map(toTreeNode);
}

function ReportingGraphCard({ node }: { node: ReportingHierarchyNode }) {
  const { employee, children, relationshipId } = node;
  return (
    <article className="reporting-lines-graph-card">
      <EmployeeDetailLabel employee={employee} className="reporting-lines-graph-name" />
      <span className="reporting-lines-graph-meta">
        {employee.organizationName || '--'} · {employee.employeeNo || '--'}
      </span>
      <span className="reporting-lines-graph-position">{employee.positionName || '--'}</span>
      <span className="reporting-lines-graph-relationship">
        {relationshipId ? `关系 ID：${relationshipId}` : '当前授权关系根'}
      </span>
      {children.length > 0 ? (
        <span className="reporting-lines-graph-directs">{children.length} 位直属成员</span>
      ) : null}
    </article>
  );
}

function ReportingGraphBranch({ node }: { node: ReportingHierarchyNode }) {
  return (
    <div className="reporting-lines-graph-branch">
      <ReportingGraphCard node={node} />
      {node.children.length > 0 ? (
        <div className="reporting-lines-graph-children">
          {node.children.map((child) => <ReportingGraphBranch key={child.employee.id} node={child} />)}
        </div>
      ) : null}
    </div>
  );
}

function ReportingQualityWarning({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <Alert
      className="content-alert reporting-lines-quality-warning"
      type="warning"
      showIcon
      message="部分关系数据无法展示，请联系管理员"
    />
  );
}

export function ReportingLinesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const view: ReportingLinesView = isReportingLinesView(rawView) || rawView === '1'
    ? (rawView === 'graph' || rawView === '1' ? 'graph' : 'list')
    : 'list';
  const query = useMemo(() => ({
    keyword: searchParams.get('keyword') || undefined,
    organizationId: searchParams.get('organizationId') || undefined,
  }), [searchParams]);
  const reporting = useReportingRelationships(useMemo(() => reportingRequestPath(query), [query]));
  const organizations = useOrganizations();
  const [keywordInput, setKeywordInput] = useState(query.keyword ?? '');
  const [graphZoom, setGraphZoom] = useState(1);

  useEffect(() => {
    setKeywordInput(query.keyword ?? '');
  }, [query.keyword]);

  const graphPayload = reporting.data?.graph ?? { nodes: [], edges: [], warnings: [] };
  const treeData = useMemo(
    () => buildReportingLinesTree(graphPayload),
    [graphPayload],
  );
  const graphData = useMemo(
    () => buildReportingLinesHierarchy(graphPayload),
    [graphPayload],
  );

  const patchSearch = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const changeView = (nextView: ReportingLinesView) => {
    patchSearch({
      view: nextView === 'graph' ? 'graph' : undefined,
      page: undefined,
    });
  };

  const refresh = () => {
    reporting.refetch();
    void organizations.refetch();
  };

  return (
    <section className="employee-list-page employment-reference-page reporting-lines-page" aria-labelledby="reporting-lines-heading">
      <header className="employee-page-heading employment-reference-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><ApartmentOutlined /></span>
          <nav className="blacklist-heading-tabs employment-reference-tabs reporting-lines-tabs" aria-label="汇报关系视图">
            <button
              className={`blacklist-heading-tab employment-reference-tab${view === 'list' ? ' is-active' : ''}`}
              type="button"
              aria-current={view === 'list' ? 'page' : undefined}
              onClick={() => changeView('list')}
            >
              {view === 'list' ? <h1 id="reporting-lines-heading">汇报关系</h1> : '汇报关系'}
            </button>
            <button
              className={`blacklist-heading-tab employment-reference-tab${view === 'graph' ? ' is-active' : ''}`}
              type="button"
              aria-current={view === 'graph' ? 'page' : undefined}
              onClick={() => changeView('graph')}
            >
              {view === 'graph' ? <h1 id="reporting-lines-heading">汇报关系图</h1> : '汇报关系图'}
            </button>
          </nav>
        </div>
        <div className="reporting-lines-header-actions" aria-label="汇报关系操作">
          <Button type="primary" disabled>批量调整汇报关系</Button>
        </div>
      </header>

      {view === 'graph' ? (
        <div className="employee-table-surface reporting-lines-graph-shell">
          <div className="reporting-lines-graph-toolbar">
            <div className="reporting-lines-graph-filters">
              <Input
                className="reporting-lines-graph-search"
                allowClear
                value={keywordInput}
                aria-label="搜索汇报关系图人员"
                placeholder="搜索人员"
                prefix={<SearchOutlined />}
                onChange={(event) => {
                  setKeywordInput(event.target.value);
                  if (!event.target.value) patchSearch({ keyword: undefined });
                }}
                onPressEnter={(event) => patchSearch({ keyword: event.currentTarget.value.trim() || undefined })}
              />
              <OrganizationTreeSelect
                allowClear
                aria-label="选择汇报关系图部门"
                className="reporting-lines-graph-organization-select"
                placeholder="部门"
                loading={organizations.isLoading}
                organizations={organizations.data ?? []}
                value={query.organizationId}
                onChange={(organizationId) => patchSearch({ organizationId })}
              />
              <Button type="link" disabled>高级筛选</Button>
            </div>
            <div className="reporting-lines-graph-actions">
              <Button disabled>显示信息 <DownOutlined /></Button>
              <Button type="primary" disabled>导出 <DownOutlined /></Button>
            </div>
          </div>

          {reporting.isError ? (
            <Alert
              className="content-alert"
              type="error"
              showIcon
              message="汇报关系图加载失败"
              description={reporting.error?.message}
              action={<Button size="small" onClick={refresh}>重试</Button>}
            />
          ) : reporting.isLoading ? (
            <div className="reporting-lines-empty-state">
              <Spin size="small" />
            </div>
          ) : (
            <>
              <ReportingQualityWarning warnings={graphPayload.warnings} />
              {graphData.length === 0 ? (
                <div className="reporting-lines-empty-state">
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有可展示的汇报关系图" />
                </div>
              ) : (
                <div className="reporting-lines-graph-viewport">
                  <div className="reporting-lines-graph-controls" aria-label="汇报关系图缩放">
                    <Tooltip title="放大">
                      <Button
                        aria-label="放大汇报关系图"
                        icon={<PlusOutlined />}
                        onClick={() => setGraphZoom((zoom) => Math.min(1.3, Number((zoom + 0.1).toFixed(1))))}
                      />
                    </Tooltip>
                    <Tooltip title="缩小">
                      <Button
                        aria-label="缩小汇报关系图"
                        icon={<MinusOutlined />}
                        onClick={() => setGraphZoom((zoom) => Math.max(0.7, Number((zoom - 0.1).toFixed(1))))}
                      />
                    </Tooltip>
                    <Tooltip title="还原">
                      <Button aria-label="还原汇报关系图" icon={<ReloadOutlined />} onClick={() => setGraphZoom(1)} />
                    </Tooltip>
                  </div>
                  <div className="reporting-lines-graph-canvas" style={{ transform: `scale(${graphZoom})` }}>
                    <div className="reporting-lines-graph-root">全部人员</div>
                    <div className="reporting-lines-graph-roots">
                      {graphData.map((node) => <ReportingGraphBranch key={node.employee.id} node={node} />)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="employee-table-surface reporting-lines-list-surface">
          <Alert
            className="employment-reference-notice reporting-lines-notice"
            showIcon
            type="info"
            message="调整员工信息后，请点击右侧刷新按钮获取最新汇报关系树"
          />

          <div className="employee-filter-toolbar employment-reference-filter-toolbar reporting-lines-filter-toolbar">
            <div className="employment-reference-filter-controls reporting-lines-filter-controls">
              <Input
                className="reporting-lines-keyword-input"
                allowClear
                value={keywordInput}
                aria-label="搜索汇报关系人员"
                placeholder="查找人员"
                prefix={<SearchOutlined />}
                onChange={(event) => {
                  setKeywordInput(event.target.value);
                  if (!event.target.value) patchSearch({ keyword: undefined });
                }}
                onPressEnter={(event) => patchSearch({ keyword: event.currentTarget.value.trim() || undefined })}
              />
              <OrganizationTreeSelect
                allowClear
                aria-label="选择汇报关系部门"
                className="reporting-lines-organization-select"
                placeholder="请选择"
                loading={organizations.isLoading}
                organizations={organizations.data ?? []}
                value={query.organizationId}
                onChange={(organizationId) => patchSearch({ organizationId })}
                style={{ width: 320 }}
              />
              <span className="reporting-lines-dotted-toggle">
                <span>展示虚线汇报关系</span>
                <Switch aria-label="展示虚线汇报关系" checked={false} disabled />
              </span>
            </div>
            <div className="reporting-lines-toolbar-tools">
              <Tooltip title="刷新">
                <Button
                  type="text"
                  aria-label="刷新汇报关系"
                  icon={<ReloadOutlined />}
                  loading={reporting.isFetching || organizations.isFetching}
                  onClick={refresh}
                />
              </Tooltip>
              <Tooltip title="关系设置暂不可用">
                <span>
                  <Button
                    type="text"
                    aria-label="汇报关系设置"
                    icon={<SettingOutlined />}
                    disabled
                  />
                </span>
              </Tooltip>
            </div>
          </div>

          {reporting.isError ? (
            <Alert
              className="content-alert"
              type="error"
              showIcon
              message="汇报关系加载失败"
              description={reporting.error?.message}
              action={<Button size="small" onClick={refresh}>重试</Button>}
            />
          ) : reporting.isLoading ? (
            <div className="reporting-lines-empty-state">
              <Spin size="small" />
            </div>
          ) : (
            <>
              <ReportingQualityWarning warnings={graphPayload.warnings} />
              {treeData.length === 0 ? (
                <div className="reporting-lines-empty-state">
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有可展示的汇报关系" />
                </div>
              ) : (
                <Tree
                  className="reporting-lines-tree"
                  blockNode
                  checkable
                  defaultExpandAll
                  showLine
                  treeData={treeData}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
