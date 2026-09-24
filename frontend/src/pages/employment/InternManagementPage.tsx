import {
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  StopOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type {
  EmploymentConversionDetail,
  EmploymentConversionListItem,
  EmploymentConversionListQuery,
  EmploymentViewCountKey,
  InternListItem,
  InternListQuery,
} from '@hr-demo/shared';
import { Alert, Button, Drawer, Empty, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { Key } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { jobLevelOptions } from '../../config/personnel-fields';
import { useEmployeeFormOptions, useOrganizations } from '../../features/employees/api';
import { useInterns } from '../../features/employment/api';
import {
  useActivateEmploymentConversion,
  useEmploymentConversion,
  useEmploymentConversions,
  useEmploymentViewCounts,
} from '../../features/employment-foundation/api';
import { ConversionRequestDrawer } from '../../features/employment-foundation/ConversionRequestDrawer';

type InternManagementView = 'current' | 'converting' | 'regularized' | 'exited';

type ConversionPageView = Extract<InternManagementView, 'converting' | 'regularized'>;

const internTabs: Array<{
  view: InternManagementView;
  label: string;
  backendView?: InternListQuery['view'];
}> = [
  { view: 'current', label: '实习生' },
  { view: 'converting', label: '实习转正中' },
  { view: 'regularized', label: '已转正' },
  { view: 'exited', label: '已离职', backendView: 'resigned' },
];

const conversionStatusLabels: Record<string, string> = {
  DRAFT: '草稿', PENDING: '待审批', APPROVED: '已通过', REJECTED: '已驳回', WITHDRAWN: '已撤回',
  PENDING_EFFECTIVE: '待生效', COMPLETED: '已完成', CANCELLED: '已取消',
};

const conversionCountKeys: Record<ConversionPageView | 'current' | 'exited', EmploymentViewCountKey> = {
  current: 'interns.intern', converting: 'interns.conversion_pending', regularized: 'interns.converted', exited: 'interns.resigned',
};

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function buildInternColumns(onRequest?: (record: InternListItem) => void): ColumnsType<InternListItem> {
  return [
    { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: displayValue },
    { title: '邮箱', dataIndex: 'workEmail', width: 180, render: displayValue },
    { title: '实习机构', dataIndex: 'internshipOrganizationName', width: 160, render: () => '--' },
    { title: '实习部门', dataIndex: 'departmentName', width: 160, render: displayValue },
    { title: '实习职位', dataIndex: 'positionName', width: 160, render: displayValue },
    { title: '实习开始日期', dataIndex: 'startDate', width: 140, render: displayValue },
    { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: () => '--' },
    { title: '直线经理', dataIndex: 'managerName', width: 130, render: () => '--' },
    { title: '银行', dataIndex: 'bankName', width: 130, render: () => '--' },
    { title: '银行账号', dataIndex: 'bankAccountNumber', width: 160, render: () => '--' },
    { title: '开户行支行', dataIndex: 'bankBranchName', width: 160, render: () => '--' },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 190,
      render: (_, record) => (
        <Space size={0}>
          {onRequest ? <Button type="link" size="small" onClick={() => onRequest(record)}>申请转正</Button> : null}
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

export const internColumns: ColumnsType<InternListItem> = buildInternColumns();

function ConversionListView({
  records,
  loading,
  onOpenDetail,
}: {
  records: EmploymentConversionListItem[];
  loading: boolean;
  onOpenDetail: (record: EmploymentConversionListItem) => void;
}) {
  const columns: ColumnsType<EmploymentConversionListItem> = [
    { title: '姓名', dataIndex: ['employee', 'name'], width: 130, render: (_value, record) => displayValue(record.employee.name) },
    { title: '工号', dataIndex: ['employee', 'employeeNo'], width: 130 },
    { title: '来源部门', dataIndex: ['source', 'organization', 'name'], width: 160, render: (_value, record) => displayValue(record.source.organization?.name) },
    { title: '目标部门', dataIndex: ['target', 'organization', 'name'], width: 160 },
    { title: '计划生效日期', dataIndex: 'plannedEffectiveDate', width: 150 },
    { title: '审批状态', dataIndex: 'status', width: 120, render: (value: string) => <Tag>{conversionStatusLabels[value] ?? value}</Tag> },
    { title: '操作', key: 'actions', fixed: 'right', width: 150, render: (_value, record) => <Button type="link" size="small" icon={<EyeOutlined />} aria-label={`查看转换申请${record.employee.name ?? ''}`} onClick={() => onOpenDetail(record)}>查看转换申请</Button> },
  ];
  return <div className="employee-table-surface employment-reference-surface"><Table<EmploymentConversionListItem> className="employee-table employment-reference-table intern-conversion-table" rowKey="id" loading={loading} columns={columns} dataSource={records} scroll={{ x: 1_050 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的转换申请" /> }} pagination={false} /></div>;
}

function CurrentInternsView({
  query,
  patchSearch,
  view,
  onRequest,
  selectedRowKeys,
  onSelectionChange,
}: {
  query: InternListQuery;
  patchSearch: (changes: Record<string, string | number | undefined>) => void;
  view: 'current' | 'exited';
  onRequest?: (record: InternListItem) => void;
  selectedRowKeys?: Key[];
  onSelectionChange?: (keys: Key[], records: InternListItem[]) => void;
}) {
  const interns = useInterns(query);
  const [keywordInput, setKeywordInput] = useState(query.keyword ?? '');

  useEffect(() => {
    setKeywordInput(query.keyword ?? '');
  }, [query.keyword]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    patchSearch({ page: pagination.current ?? 1, pageSize: pagination.pageSize ?? 10 });
  };

  return (
    <>
      {interns.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="实习生管理加载失败"
          description={interns.error.message}
          action={<Button size="small" onClick={() => interns.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar employment-reference-filter-toolbar intern-filter-toolbar">
          <div className="employment-reference-filter-controls intern-filter-controls">
            <Input.Search
              className="intern-keyword-input"
              allowClear
              value={keywordInput}
              aria-label="筛选人员"
              placeholder="人员"
              onChange={(event) => {
                setKeywordInput(event.target.value);
                if (!event.target.value) patchSearch({ keyword: undefined, page: 1 });
              }}
              onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
            />
            <Input className="intern-email-input" aria-label="筛选邮箱" placeholder="邮箱" disabled />
            <Select
              className="intern-department-select"
              aria-label="筛选实习部门"
              placeholder="实习部门"
              disabled
            />
            <Select
              className="intern-position-select"
              aria-label="筛选实习职位"
              placeholder="实习职位"
              disabled
            />
          </div>
        </div>

        <Table<InternListItem>
          className="employee-table employment-reference-table intern-table"
          rowKey="id"
          rowSelection={onSelectionChange ? { selectedRowKeys: selectedRowKeys ?? [], type: 'radio', columnWidth: 38, onChange: onSelectionChange } : { columnWidth: 38 }}
          loading={interns.isLoading}
          columns={buildInternColumns(onRequest)}
          dataSource={interns.data?.data ?? []}
          scroll={{ x: 1_650 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={view === 'exited' ? '没有符合条件的已离职实习记录' : '没有符合条件的实习生任职记录'} /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: interns.data?.meta.total ?? 0,
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

export function InternManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const view: InternManagementView = requestedView === 'converting'
    || requestedView === 'regularized'
    || requestedView === 'exited'
    ? requestedView
    : 'current';
  const selectedTab = internTabs.find((tab) => tab.view === view) ?? internTabs[0]!;
  const isConversionView = view === 'converting' || view === 'regularized';
  const conversionQuery = useMemo<EmploymentConversionListQuery>(() => ({
    view: view === 'regularized' ? 'completed' : 'in_progress',
    type: 'INTERN_TO_EMPLOYEE',
    keyword: searchParams.get('keyword') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams, view]);
  const query = useMemo<InternListQuery>(() => ({
    ...(selectedTab.backendView ? { view: selectedTab.backendView } : {}),
    keyword: searchParams.get('keyword') || undefined,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams, selectedTab]);
  const conversions = useEmploymentConversions(conversionQuery);
  const counts = useEmploymentViewCounts({});
  const organizations = useOrganizations();
  const formOptions = useEmployeeFormOptions(undefined, isConversionView || view === 'current');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [selectedIntern, setSelectedIntern] = useState<InternListItem | null>(null);
  const [requestTarget, setRequestTarget] = useState<InternListItem | null>(null);
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

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [view, searchParams.toString()]);
  useEffect(() => {
    if (detail.data) setConversionDetail(detail.data);
  }, [detail.data]);

  const countFor = (key: EmploymentViewCountKey) => counts.data?.items.find((item) => item.key === key)?.count ?? '—';
  const openDetail = (record: EmploymentConversionListItem) => {
    setDetailTarget(record);
    setConversionDetail(null);
    setDetailOpen(true);
  };
  const conversionEmployee = (record: EmploymentConversionListItem) => ({ id: record.employee.id, employeeNo: record.employee.employeeNo, name: record.employee.name });
  const selectedCurrent = selectedIntern;
  const submitSuccess = () => {
    messageApi.success('申请已提交');
    setRequestTarget(null);
    setSelectedRowKeys([]);
  };
  const activateDetail = async () => {
    if (!conversionDetail?.canActivate) return;
    await Modal.confirm({ title: '确认生效', content: '确认使该任职转换申请生效吗？', onOk: async () => { await activate.mutateAsync(conversionDetail.id); messageApi.success('生效成功'); setDetailOpen(false); } });
  };

  return (
    <section className="employee-list-page employment-reference-page intern-management-page" aria-labelledby="intern-heading">
      <header className="employee-page-heading employment-reference-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <nav className="blacklist-heading-tabs employment-reference-tabs" aria-label="实习生管理视图">
            {internTabs.map((tab) => (
              <button
                className={`blacklist-heading-tab employment-reference-tab${view === tab.view ? ' is-active' : ''}`}
                key={tab.view}
                type="button"
                onClick={() => patchSearch({ view: tab.view === 'current' ? undefined : tab.view, page: 1 })}
              >
                {view === tab.view ? <h1 id="intern-heading">{tab.label}</h1> : tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="employment-reference-actions" aria-label="实习生管理操作">
          <Button type="primary" disabled={!selectedCurrent} onClick={() => selectedCurrent && setRequestTarget(selectedCurrent)}>申请实习转正</Button>
          <Button icon={<PlusOutlined />} disabled>新增实习生</Button>
          <Button icon={<EditOutlined />} disabled>批量编辑</Button>
          <Button icon={<StopOutlined />} disabled>批量结束实习</Button>
          <Button icon={<DownOutlined />} disabled>更多操作</Button>
        </div>
      </header>

      <Alert
        className="employment-reference-notice"
        type="info"
        showIcon
        message={(
          <span>
            {view === 'exited'
              ? '已离职实习记录按退出日期的历史任职关系查询。'
              : '当前页面展示有效实习任职记录及转换申请。'}
            <span className="employment-reference-notice-link">更多常见问题及解答</span>
          </span>
        )}
      />

      <nav className="employment-reference-dashboard intern-dashboard" aria-label="实习生管理数量">
        {internTabs.map((tab) => <button className={`employment-reference-dashboard-item${view === tab.view ? ' is-active' : ''}`} key={tab.view} type="button" aria-label={tab.label} onClick={() => patchSearch({ view: tab.view === 'current' ? undefined : tab.view, page: 1 })}><span className="employment-reference-dashboard-label">{tab.label}</span><strong className="employment-reference-dashboard-count">{countFor(conversionCountKeys[tab.view])}</strong></button>)}
      </nav>
      {isConversionView ? <ConversionListView records={conversions.data?.data ?? []} loading={conversions.isLoading} onOpenDetail={openDetail} /> : <CurrentInternsView query={query} patchSearch={patchSearch} view={view} onRequest={setRequestTarget} selectedRowKeys={selectedRowKeys} onSelectionChange={(keys, records) => { setSelectedRowKeys(keys); setSelectedIntern(records[0] ?? null); }} />}
      {messageContext}
      {requestTarget ? <ConversionRequestDrawer open employee={{ id: requestTarget.employeeId, employeeNo: `--`, name: requestTarget.employeeName }} sourceEmploymentPeriodId={requestTarget.id} type="INTERN_TO_EMPLOYEE" organizations={organizations.data ?? []} positions={formOptions.data?.positions ?? []} jobTitles={formOptions.data?.jobTitles ?? []} jobLevels={jobLevelOptions} onClose={() => setRequestTarget(null)} onSuccess={submitSuccess} /> : null}
      <Drawer title="转换申请详情" open={detailOpen} onClose={() => setDetailOpen(false)} width={520} destroyOnClose>
        {detail.isLoading ? <span>加载中...</span> : conversionDetail ? <Space direction="vertical"><span>员工：{displayValue(conversionDetail.employee.name)}（{conversionDetail.employee.employeeNo}）</span><span>来源部门：{displayValue(conversionDetail.source.organization?.name)}</span><span>目标部门：{conversionDetail.target.organization.name}</span><span>计划生效日期：{conversionDetail.plannedEffectiveDate}</span><span>状态：{conversionStatusLabels[conversionDetail.status] ?? conversionDetail.status}</span>{conversionDetail.canActivate ? <Button type="primary" onClick={() => void activateDetail()}>确认生效</Button> : null}</Space> : <span>暂无详情</span>}
      </Drawer>
    </section>
  );
}
