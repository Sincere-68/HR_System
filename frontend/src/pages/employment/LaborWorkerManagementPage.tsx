import {
  DownOutlined,
  EyeOutlined,
  PlusOutlined,
  UserSwitchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { LaborWorkerListItem, LaborWorkerListQuery } from '@hr-demo/shared';
import { Alert, Button, Empty, Input, Select, Space, Table } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { workArrangementLabels } from '../../config/personnel-fields';
import { useLaborWorkers } from '../../features/employment/api';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

type LaborWorkerView = 'on-duty' | 'conversion-pending' | 'converted' | 'terminated';

const laborWorkerViews: Array<{
  view: LaborWorkerView;
  label: string;
  reason?: string;
  backendView?: LaborWorkerListQuery['view'];
}> = [
  { view: 'on-duty', label: '在岗劳务人员' },
  { view: 'conversion-pending', label: '转正式中', reason: '劳务转换事件来源待确认' },
  { view: 'converted', label: '已转正式', reason: '劳务转换完成事件来源待确认' },
  { view: 'terminated', label: '已离职', backendView: 'resigned' },
];

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

export const laborWorkerColumns: ColumnsType<LaborWorkerListItem> = [
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
    render: (_, record) => record.employeeId && record.canViewEmployeeDetail ? (
      <Link to={`/personnel/employees/${record.employeeId}`}>
        <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
      </Link>
    ) : <Button type="link" size="small" disabled>暂无详情</Button>,
  },
];

function CurrentLaborWorkersView({
  query,
  patchSearch,
  onTotalChange,
  view,
}: {
  query: LaborWorkerListQuery;
  patchSearch: (changes: Record<string, string | number | undefined>) => void;
  onTotalChange: (view: 'on-duty' | 'terminated', total: number | undefined) => void;
  view: 'on-duty' | 'terminated';
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
          rowSelection={{ columnWidth: 38 }}
          loading={laborWorkers.isLoading}
          columns={laborWorkerColumns}
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
  const query = useMemo<LaborWorkerListQuery>(() => ({
    ...(selectedViewForQuery.backendView ? { view: selectedViewForQuery.backendView } : {}),
    keyword: searchParams.get('keyword') || undefined,
    entryDateFrom: searchParams.get('entryDateFrom') || undefined,
    entryDateTo: searchParams.get('entryDateTo') || undefined,
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
  const selectedView = laborWorkerViews.find((item) => item.view === view) ?? laborWorkerViews[0]!;
  const [viewTotals, setViewTotals] = useState<Partial<Record<'on-duty' | 'terminated', number | undefined>>>({});
  const onTotalChange = useCallback((loadedView: 'on-duty' | 'terminated', total: number | undefined) => {
    setViewTotals((current) => current[loadedView] === total
      ? current
      : { ...current, [loadedView]: total });
  }, []);

  return (
    <section className="employee-list-page employment-reference-page labor-worker-management-page" aria-labelledby="labor-worker-heading">
      <header className="employee-page-heading employment-reference-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <h1 id="labor-worker-heading">劳务人员管理</h1>
        </div>
        <Space className="employment-reference-actions labor-worker-actions" size={8}>
          <Button type="primary" icon={<PlusOutlined />} disabled>新增劳务人员</Button>
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
            title={item.reason}
            onClick={() => patchSearch({ view: item.view === 'on-duty' ? undefined : item.view, page: 1 })}
          >
            <span className="employment-reference-dashboard-label">{item.label}</span>
            <strong className="employment-reference-dashboard-count">{item.view === 'conversion-pending' || item.view === 'converted'
              ? '--'
              : viewTotals[item.view] ?? '—'}</strong>
          </button>
        ))}
      </nav>

      {view === 'on-duty' || view === 'terminated' ? (
        <CurrentLaborWorkersView query={query} patchSearch={patchSearch} onTotalChange={onTotalChange} view={view} />
      ) : (
        <div className="employment-reference-unsupported" role="status">
          <strong>该视图暂不可用</strong>
          <span>暂不可用：{selectedView.reason}</span>
        </div>
      )}
    </section>
  );
}
