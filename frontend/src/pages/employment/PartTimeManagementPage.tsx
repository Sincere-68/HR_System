import {
  DownloadOutlined,
  EyeOutlined,
  PlusOutlined,
  StopOutlined,
  UploadOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type {
  AssignmentStatus,
  AssignmentType,
  PartTimeListItem,
  PartTimeListQuery,
} from '@hr-demo/shared';
import { Alert, Button, DatePicker, Empty, Input, Select, Table } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePartTimeAssignments } from '../../features/employment/api';

const assignmentTypeOptions: Array<{ value: AssignmentType; label: string }> = [
  { value: 'PRIMARY', label: '主要任职' },
  { value: 'ADDITIONAL', label: '附加任职' },
  { value: 'TEMPORARY', label: '临时任职' },
];

type PartTimeView = 'current' | 'expiring' | 'upcoming' | 'ended' | 'all' | 'approval';

const partTimeDashboardItems: Array<{
  view: PartTimeView;
  label: string;
  reason?: string;
  backendView?: PartTimeListQuery['view'];
}> = [
  { view: 'current', label: '兼职中' },
  { view: 'expiring', label: '即将到期', reason: '兼职到期窗口来源待确认' },
  { view: 'upcoming', label: '未开始', backendView: 'not_started' },
  { view: 'ended', label: '已结束', backendView: 'ended' },
  { view: 'all', label: '全部兼职记录', backendView: 'all' },
  { view: 'approval', label: '审批中的兼职', reason: '兼职审批关联来源待确认' },
];

const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  ACTIVE: '任职中',
  ENDED: '任职结束',
};

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

export const partTimeColumns: ColumnsType<PartTimeListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: displayValue },
  { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left', render: displayValue },
  { title: '兼职类型', dataIndex: 'partTimeType', width: 130, render: () => '--' },
  { title: '兼职开始日期', dataIndex: 'startDate', width: 150, render: displayValue },
  { title: '兼职机构', dataIndex: 'institutionName', width: 160, render: () => '--' },
  { title: '兼职部门', dataIndex: 'departmentName', width: 160, render: displayValue },
  { title: '兼职直线经理', dataIndex: 'managerName', width: 150, render: () => '--' },
  { title: '兼职职务', dataIndex: 'jobTitleName', width: 150, render: displayValue },
  { title: '兼职结束日期', dataIndex: 'endDate', width: 150, render: displayValue },
  {
    title: '任职状态',
    dataIndex: 'assignmentStatus',
    width: 120,
    render: (status: AssignmentStatus | null) => status ? assignmentStatusLabels[status] : '--',
  },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: () => '--' },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => record.employeeId && record.canViewEmployeeDetail ? (
      <Link to={`/personnel/employees/${record.employeeId}`}>
        <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
      </Link>
    ) : <Button type="link" size="small" disabled>暂无详情</Button>,
  },
];

function CurrentPartTimeView({
  query,
  patchSearch,
  onTotalChange,
  view,
}: {
  query: PartTimeListQuery;
  patchSearch: (changes: Record<string, string | number | undefined>) => void;
  onTotalChange: (view: Exclude<PartTimeView, 'expiring' | 'approval'>, total: number | undefined) => void;
  view: Exclude<PartTimeView, 'expiring' | 'approval'>;
}) {
  const partTimeAssignments = usePartTimeAssignments(query);
  const [keywordInput, setKeywordInput] = useState(query.keyword ?? '');
  useEffect(() => setKeywordInput(query.keyword ?? ''), [query.keyword]);
  useEffect(() => onTotalChange(view, partTimeAssignments.data?.meta.total), [partTimeAssignments.data?.meta.total, onTotalChange, view]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    patchSearch({ page: pagination.current ?? 1, pageSize: pagination.pageSize ?? 10 });
  };

  return (
    <>
      {partTimeAssignments.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="兼职管理加载失败"
          description={partTimeAssignments.error.message}
          action={<Button size="small" onClick={() => partTimeAssignments.refetch()}>重试</Button>}
        />
      ) : null}
      <div className="employee-table-surface">
        <div className="employee-filter-toolbar employment-reference-filter-toolbar part-time-filter-toolbar">
          <div className="employment-reference-filter-controls part-time-filter-controls">
            <Input.Search
              className="part-time-keyword-input"
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
            <Select
              className="part-time-assignment-type-select"
              allowClear
              aria-label="筛选任职关系类型"
              placeholder="任职关系类型"
              options={assignmentTypeOptions}
              value={query.assignmentType}
              onChange={(assignmentType) => patchSearch({ assignmentType, page: 1 })}
            />
            <Select className="part-time-department-select" aria-label="筛选兼职部门" placeholder="兼职部门" disabled />
            <Select className="part-time-job-title-select" aria-label="筛选兼职职务" placeholder="兼职职务" disabled />
            <DatePicker.RangePicker
              aria-label="筛选兼职开始日期"
              placeholder={['兼职开始日期', '兼职开始日期']}
              value={[
                query.startDateFrom ? dayjs(query.startDateFrom) : null,
                query.startDateTo ? dayjs(query.startDateTo) : null,
              ]}
              onChange={(_, dates) => patchSearch({
                startDateFrom: dates[0] || undefined,
                startDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
          </div>
        </div>
        <Table<PartTimeListItem>
          className="employee-table employment-reference-table part-time-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={partTimeAssignments.isLoading}
          columns={partTimeColumns}
          dataSource={partTimeAssignments.data?.data ?? []}
          scroll={{ x: 1_700 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query.view ? '没有符合条件的兼职任职记录' : '没有符合条件的当前兼职任职记录'} /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: partTimeAssignments.data?.meta.total ?? 0,
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

export function PartTimeManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const view: PartTimeView = requestedView === 'expiring'
    || requestedView === 'upcoming'
    || requestedView === 'ended'
    || requestedView === 'all'
    || requestedView === 'approval'
    ? requestedView
    : 'current';
  const selectedViewForQuery = partTimeDashboardItems.find((item) => item.view === view) ?? partTimeDashboardItems[0]!;
  const query = useMemo<PartTimeListQuery>(() => ({
    ...(selectedViewForQuery.backendView ? { view: selectedViewForQuery.backendView } : {}),
    keyword: searchParams.get('keyword') || undefined,
    assignmentType: (searchParams.get('assignmentType') as AssignmentType | null) ?? undefined,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    endDateFrom: searchParams.get('endDateFrom') || undefined,
    endDateTo: searchParams.get('endDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams, selectedViewForQuery]);
  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };
  const selectedView = partTimeDashboardItems.find((item) => item.view === view) ?? partTimeDashboardItems[0]!;
  const [viewTotals, setViewTotals] = useState<Partial<Record<'current' | 'upcoming' | 'ended' | 'all', number | undefined>>>({});
  const onTotalChange = useCallback((loadedView: 'current' | 'upcoming' | 'ended' | 'all', total: number | undefined) => {
    setViewTotals((current) => current[loadedView] === total
      ? current
      : { ...current, [loadedView]: total });
  }, []);

  return (
    <section className="employee-list-page employment-reference-page part-time-management-page" aria-labelledby="part-time-heading">
      <header className="employee-page-heading employment-reference-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <h1 id="part-time-heading">兼职管理</h1>
        </div>
        <div className="employment-reference-actions part-time-management-actions" aria-label="兼职管理操作">
          <Button aria-label="新增兼职" type="primary" icon={<PlusOutlined />} disabled>新增兼职</Button>
          <Button aria-label="新增兼职申请" icon={<PlusOutlined />} disabled>新增兼职申请</Button>
          <Button aria-label="批量结束兼职" icon={<StopOutlined />} disabled>批量结束兼职</Button>
          <Button aria-label="导出" icon={<DownloadOutlined />} disabled>导出</Button>
          <Button aria-label="导入兼职记录" icon={<UploadOutlined />} disabled>导入兼职记录</Button>
        </div>
      </header>
      <nav className="employment-reference-tabs employment-reference-dashboard part-time-management-dashboard" aria-label="兼职管理视图">
        {partTimeDashboardItems.map((item) => (
          <button
            className={`employment-reference-tab employment-reference-dashboard-item${view === item.view ? ' is-active' : ''}`}
            key={item.view}
            type="button"
            title={item.reason}
            onClick={() => patchSearch({ view: item.view === 'current' ? undefined : item.view, page: 1 })}
          >
            <span className="employment-reference-dashboard-label">{item.label}</span>
            <strong className="employment-reference-dashboard-count">{item.view === 'expiring' || item.view === 'approval'
              ? '--'
              : viewTotals[item.view] ?? '—'}</strong>
          </button>
        ))}
      </nav>
      {view === 'current' || view === 'upcoming' || view === 'ended' || view === 'all' ? (
        <CurrentPartTimeView query={query} patchSearch={patchSearch} onTotalChange={onTotalChange} view={view} />
      ) : (
        <div className="employment-reference-unsupported" role="status">
          <strong>该视图暂不可用</strong>
          <span>暂不可用：{selectedView.reason}</span>
        </div>
      )}
    </section>
  );
}
