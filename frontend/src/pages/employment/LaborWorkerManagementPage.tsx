import {
  DownOutlined,
  EyeOutlined,
  PlusOutlined,
  UserSwitchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type {
  EmploymentConversionDetail,
  EmploymentConversionListItem,
  EmploymentConversionListQuery,
  EmploymentViewCountKey,
  LaborWorkerListItem,
  LaborWorkerListQuery,
} from '@hr-demo/shared';
import { Alert, Button, Drawer, Empty, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { Key } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { jobLevelOptions, workArrangementLabels } from '../../config/personnel-fields';
import { useEmployeeFormOptions, useOrganizations } from '../../features/employees/api';
import { useLaborWorkers } from '../../features/employment/api';
import {
  useActivateEmploymentConversion,
  useEmploymentConversion,
  useEmploymentConversions,
  useEmploymentViewCounts,
} from '../../features/employment-foundation/api';
import { ConversionRequestDrawer } from '../../features/employment-foundation/ConversionRequestDrawer';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

type LaborWorkerView = 'on-duty' | 'conversion-pending' | 'converted' | 'terminated';
type ConversionPageView = Extract<LaborWorkerView, 'conversion-pending' | 'converted'>;

const laborWorkerViews: Array<{
  view: LaborWorkerView;
  label: string;
  backendView?: LaborWorkerListQuery['view'];
}> = [
  { view: 'on-duty', label: '在岗劳务人员' },
  { view: 'conversion-pending', label: '转正式中' },
  { view: 'converted', label: '已转正式' },
  { view: 'terminated', label: '已离职', backendView: 'resigned' },
];

const conversionStatusLabels: Record<string, string> = {
  DRAFT: '草稿', PENDING: '待审批', APPROVED: '已通过', REJECTED: '已驳回', WITHDRAWN: '已撤回',
  PENDING_EFFECTIVE: '待生效', COMPLETED: '已完成', CANCELLED: '已取消',
};
const conversionCountKeys: Record<ConversionPageView | 'on-duty' | 'terminated', EmploymentViewCountKey> = {
  'on-duty': 'labor.on_duty', 'conversion-pending': 'labor.conversion_pending', converted: 'labor.converted', terminated: 'labor.resigned',
};

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function buildLaborWorkerColumns(onRequest?: (record: LaborWorkerListItem) => void): ColumnsType<LaborWorkerListItem> {
  return [
  { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: displayValue },
  { title: '电子邮箱', dataIndex: 'workEmail', width: 180, render: displayValue },
  { title: '工号', dataIndex: 'employeeNo', width: 130, render: displayValue },
  { title: '入职日期', dataIndex: 'entryDate', width: 130, render: displayValue },
  { title: '部门', dataIndex: 'departmentName', width: 170, render: displayValue },
  { title: '职务', dataIndex: 'jobTitleName', width: 150, render: displayValue },
  {
    title: '用工形式',
    dataIndex: 'workArrangement',
    width: 130,
    render: (value) => displayValue(value ? workArrangementLabels[value as keyof typeof workArrangementLabels] ?? value : null),
  },
  { title: '直线经理', dataIndex: 'managerName', width: 130, render: displayValue },
  { title: '工作地点', dataIndex: 'workplaceName', width: 150, render: displayValue },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => (
      <Space size={0}>
        {onRequest ? <Button type="link" size="small" onClick={() => onRequest(record)}>申请转正式</Button> : null}
        {record.employeeId && record.canViewEmployeeDetail ? (
          <Link to={`/personnel/employees/${record.employeeId}`}>
            <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
          </Link>
        ) : <Button type="link" size="small" disabled>暂无详情</Button>}
      </Space>
    ),
  },
];
}

export const laborWorkerColumns: ColumnsType<LaborWorkerListItem> = buildLaborWorkerColumns();

function ConversionListView({ records, loading, onOpenDetail }: { records: EmploymentConversionListItem[]; loading: boolean; onOpenDetail: (record: EmploymentConversionListItem) => void }) {
  const columns: ColumnsType<EmploymentConversionListItem> = [
    { title: '姓名', dataIndex: ['employee', 'name'], width: 130, render: (_value, record) => displayValue(record.employee.name) },
    { title: '工号', dataIndex: ['employee', 'employeeNo'], width: 130 },
    { title: '来源部门', dataIndex: ['source', 'organization', 'name'], width: 160, render: (_value, record) => displayValue(record.source.organization?.name) },
    { title: '目标部门', dataIndex: ['target', 'organization', 'name'], width: 160 },
    { title: '计划生效日期', dataIndex: 'plannedEffectiveDate', width: 150 },
    { title: '审批状态', dataIndex: 'status', width: 120, render: (value: string) => <Tag>{conversionStatusLabels[value] ?? value}</Tag> },
    { title: '操作', key: 'actions', fixed: 'right', width: 150, render: (_value, record) => <Button type="link" size="small" icon={<EyeOutlined />} aria-label={`查看转换申请${record.employee.name ?? ''}`} onClick={() => onOpenDetail(record)}>查看转换申请</Button> },
  ];
  return <div className="employee-table-surface employment-reference-surface"><Table<EmploymentConversionListItem> className="employee-table employment-reference-table labor-conversion-table" rowKey="id" loading={loading} columns={columns} dataSource={records} scroll={{ x: 1_050 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的转换申请" /> }} pagination={false} /></div>;
}

function CurrentLaborWorkersView({
  query,
  patchSearch,
  onTotalChange,
  view,
  onRequest,
  selectedRowKeys,
  onSelectionChange,
}: {
  query: LaborWorkerListQuery;
  patchSearch: (changes: Record<string, string | number | undefined>) => void;
  onTotalChange: (view: 'on-duty' | 'terminated', total: number | undefined) => void;
  view: 'on-duty' | 'terminated';
  onRequest?: (record: LaborWorkerListItem) => void;
  selectedRowKeys?: Key[];
  onSelectionChange?: (keys: Key[], records: LaborWorkerListItem[]) => void;
}) {
  const laborWorkers = useLaborWorkers(query);
  const [keywordInput, setKeywordInput] = useState(query.keyword ?? '');
  useEffect(() => setKeywordInput(query.keyword ?? ''), [query.keyword]);
  useEffect(() => onTotalChange(view, laborWorkers.data?.meta.total), [laborWorkers.data?.meta.total, onTotalChange, view]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    patchSearch({ page: pagination.current ?? 1, pageSize: pagination.pageSize ?? 10 });
  };

  return (
    <>
      {laborWorkers.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="劳务人员管理加载失败"
          description={laborWorkers.error.message}
          action={<Button size="small" onClick={() => laborWorkers.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface employment-reference-surface">
        <div className="employee-filter-toolbar employment-reference-filter-toolbar labor-worker-filter-toolbar">
          <div className="employment-reference-filter-controls labor-worker-filter-controls">
            <Input.Search
              className="labor-worker-keyword-input"
              allowClear
              value={keywordInput}
              aria-label="筛选人员"
              placeholder="人员"
              onChange={(event) => setKeywordInput(event.target.value)}
              onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
            />
            <Input className="labor-worker-email-input" aria-label="筛选电子邮箱" placeholder="电子邮箱" disabled />
            <Select className="labor-worker-department-filter" aria-label="筛选部门" placeholder="部门" disabled />
          </div>
        </div>

        <Table<LaborWorkerListItem>
          className="employee-table employment-reference-table labor-worker-table"
          rowKey="id"
          rowSelection={onSelectionChange ? { selectedRowKeys: selectedRowKeys ?? [], type: 'radio', columnWidth: 38, onChange: onSelectionChange } : { columnWidth: 38 }}
          loading={laborWorkers.isLoading}
          columns={buildLaborWorkerColumns(onRequest)}
          dataSource={laborWorkers.data?.data ?? []}
          scroll={{ x: 1_450 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={view === 'terminated' ? '没有符合条件的已离职劳务记录' : '没有符合条件的当前劳务人员任职记录'} /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: laborWorkers.data?.meta.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
          }}
          onChange={handleTableChange}
        />
      </div>
    </>
  );
}

export function LaborWorkerManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const view: LaborWorkerView = requestedView === 'conversion-pending'
    || requestedView === 'converted'
    || requestedView === 'terminated'
    ? requestedView
    : 'on-duty';
  const selectedViewForQuery = laborWorkerViews.find((item) => item.view === view) ?? laborWorkerViews[0]!;
  const isConversionView = view === 'conversion-pending' || view === 'converted';
  const conversionQuery = useMemo<EmploymentConversionListQuery>(() => ({
    view: view === 'converted' ? 'completed' : 'in_progress', type: 'LABOR_TO_EMPLOYEE',
    keyword: searchParams.get('keyword') || undefined, page: positiveInt(searchParams.get('page'), 1), pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams, view]);
  const query = useMemo<LaborWorkerListQuery>(() => ({
    ...(selectedViewForQuery.backendView ? { view: selectedViewForQuery.backendView } : {}),
    keyword: searchParams.get('keyword') || undefined,
    entryDateFrom: searchParams.get('entryDateFrom') || undefined,
    entryDateTo: searchParams.get('entryDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams, selectedViewForQuery]);
  const conversions = useEmploymentConversions(conversionQuery);
  const counts = useEmploymentViewCounts({});
  const organizations = useOrganizations();
  const formOptions = useEmployeeFormOptions(undefined, isConversionView || view === 'on-duty');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<LaborWorkerListItem | null>(null);
  const [requestTarget, setRequestTarget] = useState<LaborWorkerListItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<EmploymentConversionListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [conversionDetail, setConversionDetail] = useState<EmploymentConversionDetail | null>(null);
  const detail = useEmploymentConversion(detailTarget?.id ?? '', detailOpen);
  const activate = useActivateEmploymentConversion();
  const [messageApi, messageContext] = message.useMessage();

  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };
  const selectedView = laborWorkerViews.find((item) => item.view === view) ?? laborWorkerViews[0]!;
  const [viewTotals, setViewTotals] = useState<Partial<Record<'on-duty' | 'terminated', number | undefined>>>({});
  const onTotalChange = useCallback((loadedView: 'on-duty' | 'terminated', total: number | undefined) => {
    setViewTotals((current) => current[loadedView] === total ? current : { ...current, [loadedView]: total });
  }, []);
  useEffect(() => { setSelectedRowKeys([]); setSelectedWorker(null); }, [view, searchParams.toString()]);
  useEffect(() => {
    if (detail.data && detail.data.id === detailTarget?.id) setConversionDetail(detail.data);
  }, [detail.data, detailTarget?.id]);
  const countFor = (key: EmploymentViewCountKey) => {
    const countItem = counts.data?.items.find((item) => item.key === key);
    if (countItem) return countItem.count;
    const fallbackView = key === 'labor.on_duty'
      ? 'on-duty'
      : key === 'labor.resigned'
        ? 'terminated'
        : null;
    return fallbackView ? viewTotals[fallbackView] ?? '—' : '—';
  };
  const openDetail = (record: EmploymentConversionListItem) => { setDetailTarget(record); setConversionDetail(null); setDetailOpen(true); };
  const submitSuccess = () => { messageApi.success('申请已提交'); setRequestTarget(null); setSelectedRowKeys([]); setSelectedWorker(null); };
  const activateDetail = async () => { if (!conversionDetail?.canActivate) return; await Modal.confirm({ title: '确认生效', content: '确认使该任职转换申请生效吗？', onOk: async () => { await activate.mutateAsync(conversionDetail.id); messageApi.success('生效成功'); setDetailOpen(false); } }); };

  return (
    <section className="employee-list-page employment-reference-page labor-worker-management-page" aria-labelledby="labor-worker-heading">
      <header className="employee-page-heading employment-reference-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <h1 id="labor-worker-heading">劳务人员管理</h1>
        </div>
        <Space className="employment-reference-actions labor-worker-actions" size={8}>
          <Button type="primary" icon={<PlusOutlined />} aria-label="申请劳务转正式" disabled={!selectedWorker} onClick={() => selectedWorker && setRequestTarget(selectedWorker)}>申请转正式</Button>
          <Button icon={<UploadOutlined />} disabled>导入</Button>
          <Button icon={<DownOutlined />} disabled>导出</Button>
        </Space>
      </header>

      <nav className="employment-reference-dashboard labor-worker-dashboard" aria-label="劳务人员管理视图">
        {laborWorkerViews.map((item) => (
          <button
            className={`employment-reference-dashboard-item${view === item.view ? ' is-active' : ''}`}
            key={item.view}
            type="button"
            aria-label={item.label}
            onClick={() => patchSearch({ view: item.view === 'on-duty' ? undefined : item.view, page: 1 })}
          >
            <span className="employment-reference-dashboard-label">{item.label}</span>
            <strong className="employment-reference-dashboard-count">{countFor(conversionCountKeys[item.view])}</strong>
          </button>
        ))}
      </nav>

      {isConversionView ? <ConversionListView records={conversions.data?.data ?? []} loading={conversions.isLoading} onOpenDetail={openDetail} /> : <CurrentLaborWorkersView query={query} patchSearch={patchSearch} onTotalChange={onTotalChange} view={view} onRequest={setRequestTarget} selectedRowKeys={selectedRowKeys} onSelectionChange={(keys, records) => { setSelectedRowKeys(keys); setSelectedWorker(records[0] ?? null); }} />}
      {messageContext}
      {requestTarget ? <ConversionRequestDrawer open employee={{ id: requestTarget.employeeId, employeeNo: requestTarget.employeeNo, name: requestTarget.employeeName }} sourceEmploymentPeriodId={requestTarget.id} type="LABOR_TO_EMPLOYEE" organizations={organizations.data ?? []} positions={formOptions.data?.positions ?? []} jobTitles={formOptions.data?.jobTitles ?? []} jobLevels={jobLevelOptions} onClose={() => setRequestTarget(null)} onSuccess={submitSuccess} /> : null}
      <Drawer title="转换申请详情" open={detailOpen} onClose={() => setDetailOpen(false)} width={520} destroyOnClose>
        {detail.isLoading ? <span>加载中...</span> : conversionDetail ? <Space direction="vertical"><span>员工：{displayValue(conversionDetail.employee.name)}（{conversionDetail.employee.employeeNo}）</span><span>来源部门：{displayValue(conversionDetail.source.organization?.name)}</span><span>目标部门：{conversionDetail.target.organization.name}</span><span>计划生效日期：{conversionDetail.plannedEffectiveDate}</span><span>状态：{conversionStatusLabels[conversionDetail.status] ?? conversionDetail.status}</span>{conversionDetail.canActivate ? <Button type="primary" onClick={() => void activateDetail()}>确认生效</Button> : null}</Space> : <span>暂无详情</span>}
      </Drawer>
    </section>
  );
}
