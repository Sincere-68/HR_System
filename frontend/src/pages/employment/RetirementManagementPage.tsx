import { DownOutlined, EyeOutlined, UserSwitchOutlined } from '@ant-design/icons';
import type {
  Gender,
  ProcessStatus,
  RetirementListItem,
  RetirementListQuery,
} from '@hr-demo/shared';
import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Input,
  Select,
  Space,
  Table,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import { useOrganizations } from '../../features/employees/api';
import { useRetirements } from '../../features/employment/api';

const genderLabels: Record<Gender, string> = {
  MALE: '男',
  FEMALE: '女',
  UNDISCLOSED: '保密',
};

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

const retirementViewReasons = {
  inProgress: '退休办理中状态计数来源待确认',
  overdue: '退休过期规则来源待确认',
  completed: '退休完成状态来源待确认',
  all: '退休全量历史计数来源待确认',
  intentionApplication: '退休意向申请来源尚未接入',
} as const;

export const retirementColumns: ColumnsType<RetirementListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 130, fixed: 'left', render: displayValue },
  { title: '工号', dataIndex: 'employeeNo', width: 130, fixed: 'left', render: displayValue },
  {
    title: '性别',
    dataIndex: 'gender',
    width: 100,
    render: (gender: Gender | null) => gender ? genderLabels[gender] : '--',
  },
  { title: '年龄', dataIndex: 'age', width: 100, render: displayValue },
  { title: '出生日期', dataIndex: 'birthDate', width: 130, render: displayValue },
  { title: '预计退休日期', dataIndex: 'plannedRetirementDate', width: 150, render: displayValue },
  { title: '部门', dataIndex: 'departmentName', width: 180, render: displayValue },
  { title: '职务', dataIndex: 'jobTitleName', width: 150, render: displayValue },
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

type RetirementView = NonNullable<RetirementListQuery['view']>;

const retirementViewItems: Array<{ view: RetirementView; label: string; reason?: string }> = [
  { view: 'upcoming', label: '即将退休' },
  { view: 'in_progress', label: '退休中员工' },
  { view: 'overdue', label: '过期未退休员工' },
  { view: 'completed', label: '已完成的退休' },
  { view: 'all', label: '全部退休记录' },
  { view: 'intention_application', label: '意向退休日期申请', reason: retirementViewReasons.intentionApplication },
];

function isRetirementView(value: string | null): value is RetirementView {
  return retirementViewItems.some((item) => item.view === value);
}

function RetirementListView({
  query,
  view,
  patchSearch,
  onTotalChange,
}: {
  query: RetirementListQuery;
  view: Exclude<RetirementView, 'intention_application'>;
  patchSearch: (changes: Record<string, string | number | undefined>) => void;
  onTotalChange: (view: RetirementView, total: number | undefined) => void;
}) {
  const retirements = useRetirements(query);
  const organizations = useOrganizations();
  const [keywordInput, setKeywordInput] = useState(query.keyword ?? '');

  useEffect(() => {
    setKeywordInput(query.keyword ?? '');
  }, [query.keyword]);

  useEffect(() => {
    onTotalChange(view, retirements.data?.meta.total);
  }, [onTotalChange, retirements.data?.meta.total, view]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    patchSearch({ page: pagination.current ?? 1, pageSize: pagination.pageSize ?? 10 });
  };

  const clearFilters = () => {
    patchSearch({
      keyword: undefined,
      departmentId: undefined,
      plannedRetirementDateFrom: undefined,
      plannedRetirementDateTo: undefined,
      status: undefined,
      page: 1,
    });
  };

  return (
    <>
      {retirements.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="退休管理加载失败"
          description={retirements.error.message}
          action={<Button size="small" onClick={() => retirements.refetch()}>重试</Button>}
        />
      ) : null}
      {organizations.isError ? (
        <Alert
          className="content-alert"
          type="warning"
          showIcon
          message="部门筛选加载失败"
          description={organizations.error instanceof Error
            ? organizations.error.message
            : '暂时无法加载部门选项，列表仍可正常使用。'}
          action={<Button size="small" onClick={() => organizations.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface employment-reference-surface">
        <div className="employee-filter-toolbar employment-reference-filter-toolbar retirement-filter-toolbar">
          <div className="employment-reference-filter-controls retirement-filter-controls">
            <Input.Search
              className="retirement-keyword-input"
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
              allowClear
              aria-label="筛选性别"
              placeholder="性别"
              disabled
              style={{ width: 106 }}
            />
            <DatePicker.RangePicker
              aria-label="筛选预计退休日期"
              placeholder={['预计退休日期', '预计退休日期']}
              value={[
                query.plannedRetirementDateFrom ? dayjs(query.plannedRetirementDateFrom) : null,
                query.plannedRetirementDateTo ? dayjs(query.plannedRetirementDateTo) : null,
              ]}
              onChange={(_, dates) => patchSearch({
                plannedRetirementDateFrom: dates[0] || undefined,
                plannedRetirementDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
            <OrganizationTreeSelect
              className="retirement-department-select"
              allowClear
              aria-label="筛选退休部门"
              placeholder="部门"
              loading={organizations.isLoading}
              organizations={organizations.data ?? []}
              value={query.departmentId}
              onChange={(departmentId) => patchSearch({ departmentId, page: 1 })}
            />
          </div>
          <Button type="link" onClick={clearFilters}>清空已选</Button>
        </div>

        <Table<RetirementListItem>
          className="employee-table employment-reference-table retirement-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={retirements.isLoading}
          columns={retirementColumns}
          dataSource={retirements.data?.data ?? []}
          scroll={{ x: 1_250 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的退休记录" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: retirements.data?.meta.total ?? 0,
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

export function RetirementManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = isRetirementView(searchParams.get('view')) ? searchParams.get('view') as RetirementView : 'upcoming';
  const selectedRetirementView = retirementViewItems.find((item) => item.view === view) ?? retirementViewItems[0]!;
  const query = useMemo<RetirementListQuery>(() => ({
    view,
    keyword: searchParams.get('keyword') || undefined,
    status: (searchParams.get('status') as ProcessStatus | null) ?? undefined,
    plannedRetirementDateFrom: searchParams.get('plannedRetirementDateFrom') || undefined,
    plannedRetirementDateTo: searchParams.get('plannedRetirementDateTo') || undefined,
    departmentId: searchParams.get('departmentId') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams, view]);
  const [viewTotals, setViewTotals] = useState<Partial<Record<RetirementView, number | undefined>>>({});
  const onTotalChange = useCallback((loadedView: RetirementView, total: number | undefined) => {
    setViewTotals((current) => current[loadedView] === total
      ? current
      : { ...current, [loadedView]: total });
  }, []);

  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  return (
    <section className="employee-list-page employment-reference-page retirement-management-page" aria-labelledby="retirement-heading">
      <header className="employee-page-heading employment-reference-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <h1 id="retirement-heading">退休管理</h1>
        </div>
        <Space className="employment-reference-actions retirement-actions" size={8}>
          <Button type="primary" disabled>退休</Button>
          <Button disabled>退休申请</Button>
          <Button icon={<DownOutlined />} disabled>导出</Button>
        </Space>
      </header>

      <nav className="employment-reference-dashboard retirement-dashboard" aria-label="退休管理视图">
        {retirementViewItems.map((item) => {
          const supported = item.view !== 'intention_application';
          const isActive = view === item.view;
          return (
            <button
              className={`employment-reference-dashboard-item${isActive ? ' is-active' : ''}`}
              key={item.view}
              type="button"
              disabled={!supported}
              title={item.reason}
              onClick={() => supported && patchSearch({ view: item.view, page: 1 })}
            >
              <span className="employment-reference-dashboard-label">{item.label}</span>
              <strong className="employment-reference-dashboard-count">{supported
                ? viewTotals[item.view] ?? (item.view === view ? '—' : '—')
                : '--'}</strong>
              {!supported ? <span className="employment-reference-dashboard-status">暂不可用：{item.reason}</span> : null}
            </button>
          );
        })}
      </nav>

      <Alert
        className="employment-reference-notice"
        type="info"
        showIcon
        message="在此页面可查看临近预计退休日期尚未发起退休的人员。"
      />

      {view === 'intention_application' ? (
        <div className="employment-reference-unsupported" role="status">
          <strong>该视图暂不可用</strong>
          <span>暂不可用：{selectedRetirementView.reason}</span>
        </div>
      ) : (
        <RetirementListView
          query={query}
          view={view}
          patchSearch={patchSearch}
          onTotalChange={onTotalChange}
        />
      )}
    </section>
  );
}
