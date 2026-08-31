import { EyeOutlined, ProfileOutlined } from '@ant-design/icons';
import type {
  AssignmentStatus,
  EmploymentRecordListItem,
  EmploymentRecordListQuery,
  EmploymentRecordListView,
  EmploymentStatus,
} from '@hr-demo/shared';
import { Alert, Button, DatePicker, Empty, Input, Select, Table, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOrganizations } from '../../features/employees/api';
import { useEmploymentRecords } from '../../features/employment/api';

const personnelStatusLabels: Record<EmploymentStatus, string> = {
  PROBATION: '试用',
  REGULAR: '正式',
  PENDING_ENTRY: '待入职',
  TRANSFERRED_OUT: '调出',
  PENDING_TRANSFER_IN: '待调入',
  RETIRED: '退休',
  RESIGNED: '离职',
  NON_REGULAR: '非正式',
};

const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  ACTIVE: '任职中',
  ENDED: '任职结束',
};

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isView(value: string | null): value is EmploymentRecordListView {
  return value === 'current' || value === 'history';
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function PlaceholderCell() {
  return <span>--</span>;
}

export const employmentRecordColumns: ColumnsType<EmploymentRecordListItem> = [
  { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left', render: displayValue },
  { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: displayValue },
  { title: '入职日期', dataIndex: 'entryDate', width: 120, render: displayValue },
  { title: '任职部门', dataIndex: 'departmentName', width: 160, render: displayValue },
  { title: '任职职位', dataIndex: 'positionName', width: 150, render: displayValue },
  { title: '现岗位开始日期', dataIndex: 'positionStartDate', width: 150, render: displayValue },
  { title: '现岗位结束日期', dataIndex: 'positionEndDate', width: 150, render: displayValue },
  { title: '人员定位', dataIndex: 'personnelLocator', width: 120, render: () => <PlaceholderCell /> },
  {
    title: '人员状态',
    dataIndex: 'personnelStatus',
    width: 120,
    render: (status: EmploymentStatus | null) => status
      ? <Tag color={status === 'REGULAR' ? 'success' : 'default'}>{personnelStatusLabels[status]}</Tag>
      : '--',
  },
  {
    title: '任职状态',
    dataIndex: 'assignmentStatus',
    width: 120,
    render: (status: AssignmentStatus) => assignmentStatusLabels[status],
  },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: () => <PlaceholderCell /> },
  {
    title: '是否最新主职记录',
    dataIndex: 'isLatestPrimaryRecord',
    width: 160,
    render: (value: boolean) => value ? '是' : '否',
  },
  { title: '面试评价', dataIndex: 'interviewEvaluation', width: 130, render: () => <PlaceholderCell /> },
  {
    title: '简历信息',
    dataIndex: 'availability',
    width: 120,
    render: (availability: EmploymentRecordListItem['availability']) => availability === 'AVAILABLE' ? '有附件' : '--',
  },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => record.canViewEmployeeDetail ? (
      <Link to={`/personnel/employees/${record.employeeId}`}>
        <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
      </Link>
    ) : <Button type="link" size="small" disabled>暂无详情</Button>,
  },
];

export function EmploymentRecordsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const view: EmploymentRecordListView = isView(rawView) ? rawView : 'current';
  const query = useMemo<EmploymentRecordListQuery>(() => ({
    view,
    keyword: searchParams.get('keyword') || undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    personnelStatus: (searchParams.get('personnelStatus') as EmploymentStatus | null) ?? undefined,
    assignmentStatus: view === 'history'
      ? (searchParams.get('assignmentStatus') as AssignmentStatus | null) ?? undefined
      : undefined,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams, view]);
  const records = useEmploymentRecords(query);
  const organizations = useOrganizations();

  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const changeView = (nextView: EmploymentRecordListView) => {
    patchSearch({ view: nextView, assignmentStatus: undefined, page: 1 });
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    patchSearch({ page: pagination.current ?? 1, pageSize: pagination.pageSize ?? 10 });
  };

  return (
    <section className="employee-list-page employment-records-page" aria-labelledby="employment-records-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><ProfileOutlined /></span>
          <nav className="blacklist-heading-tabs" aria-label="任职记录口径">
            <button
              className={`blacklist-heading-tab${view === 'current' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('current')}
            >
              <h1 id="employment-records-heading">当前任职记录</h1>
            </button>
            <button
              className={`blacklist-heading-tab${view === 'history' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('history')}
            >
              完整任职历史
            </button>
          </nav>
        </div>
      </header>

      {records.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="任职记录加载失败"
          description={records.error.message}
          action={<Button size="small" onClick={() => records.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar employee-change-filter-toolbar">
          <div className="employee-change-filter-controls">
            <Input.Search
              className="employee-change-keyword-input"
              allowClear
              value={query.keyword ?? ''}
              aria-label="搜索任职记录"
              placeholder="搜索姓名或工号"
              onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              aria-label="筛选任职部门"
              placeholder="任职部门"
              loading={organizations.isLoading}
              value={query.organizationId}
              options={(organizations.data ?? []).map(({ id, name }) => ({ value: id, label: name }))}
              onChange={(organizationId) => patchSearch({ organizationId, page: 1 })}
              style={{ width: 180 }}
            />
            <Select
              allowClear
              aria-label="筛选人员状态"
              placeholder="人员状态"
              value={query.personnelStatus}
              options={Object.entries(personnelStatusLabels).map(([value, label]) => ({ value, label }))}
              onChange={(personnelStatus) => patchSearch({ personnelStatus, page: 1 })}
              style={{ width: 130 }}
            />
            {view === 'history' ? (
              <Select
                allowClear
                aria-label="筛选任职状态"
                placeholder="任职状态"
                value={query.assignmentStatus}
                options={Object.entries(assignmentStatusLabels).map(([value, label]) => ({ value, label }))}
                onChange={(assignmentStatus) => patchSearch({ assignmentStatus, page: 1 })}
                style={{ width: 130 }}
              />
            ) : null}
            <DatePicker.RangePicker
              aria-label="筛选现岗位开始日期"
              value={query.startDateFrom && query.startDateTo
                ? [dayjs(query.startDateFrom), dayjs(query.startDateTo)]
                : null}
              onChange={(_, dates) => patchSearch({
                startDateFrom: dates[0] || undefined,
                startDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
          </div>
          <Typography.Text type="secondary">共 {records.data?.meta.total ?? 0} 条</Typography.Text>
        </div>

        <Table<EmploymentRecordListItem>
          className="employee-table employment-records-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={records.isLoading}
          columns={employmentRecordColumns}
          dataSource={records.data?.data ?? []}
          scroll={{ x: 2_050 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={view === 'current' ? '没有符合条件的当前任职记录' : '没有符合条件的任职历史'} /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: records.data?.meta.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
          }}
          onChange={handleTableChange}
        />
      </div>
    </section>
  );
}
