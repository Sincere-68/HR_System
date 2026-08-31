import { EyeOutlined, LogoutOutlined } from '@ant-design/icons';
import type { ProcessStatus, TerminationListItem, TerminationListQuery } from '@hr-demo/shared';
import { Alert, Button, DatePicker, Empty, Input, Select, Table, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTerminations } from '../../features/employment/api';

const statusLabels: Record<ProcessStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
  IN_PROGRESS: '处理中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function StatusCell({ status }: { status: ProcessStatus | null }) {
  if (!status) return <span>--</span>;
  const color = status === 'APPROVED' || status === 'COMPLETED'
    ? 'success'
    : status === 'REJECTED' || status === 'CANCELLED'
      ? 'error'
      : status === 'PENDING' || status === 'IN_PROGRESS'
        ? 'processing'
        : 'default';
  return <Tag color={color}>{statusLabels[status]}</Tag>;
}

export const terminationColumns: ColumnsType<TerminationListItem> = [
  { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left', render: displayValue },
  { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: displayValue },
  { title: '离职前部门', dataIndex: 'previousDepartmentName', width: 170, render: displayValue },
  { title: '离职前职位', dataIndex: 'previousPositionName', width: 150, render: displayValue },
  {
    title: '最后工作日',
    dataIndex: 'lastWorkingDate',
    width: 160,
    render: (date: string, record) => (
      <span>{displayValue(date)} <Typography.Text type="secondary">（{record.lastWorkingDateBasis === 'ACTUAL' ? '实际' : '计划'}）</Typography.Text></span>
    ),
  },
  { title: '离职类型', dataIndex: 'terminationType', width: 130, render: displayValue },
  { title: '离职原因', dataIndex: 'terminationReason', width: 200, ellipsis: true, render: displayValue },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: (status) => <StatusCell status={status} /> },
  { title: '当前审批人', dataIndex: 'currentApproverName', width: 140, render: displayValue },
  { title: '离职交接状态', dataIndex: 'handoverStatus', width: 140, render: (status) => <StatusCell status={status} /> },
  { title: '离职补偿金', dataIndex: 'compensationAmount', width: 140, render: displayValue },
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

export function TerminationManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const view = requestedView === 'completed' || requestedView === 'all' ? requestedView : 'active';
  const query = useMemo<TerminationListQuery>(() => ({
    view,
    keyword: searchParams.get('keyword') || undefined,
    status: (searchParams.get('status') as ProcessStatus | null) ?? undefined,
    lastWorkingDateFrom: searchParams.get('lastWorkingDateFrom') || undefined,
    lastWorkingDateTo: searchParams.get('lastWorkingDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams, view]);
  const terminations = useTerminations(query);

  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };
  const handleTableChange = (pagination: TablePaginationConfig) => {
    patchSearch({ page: pagination.current ?? 1, pageSize: pagination.pageSize ?? 10 });
  };

  return (
    <section className="employee-list-page termination-management-page" aria-labelledby="termination-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><LogoutOutlined /></span>
          <nav className="blacklist-heading-tabs" aria-label="离职管理功能">
            <button
              className={`blacklist-heading-tab${view === 'active' ? ' is-active' : ''}`}
              type="button"
              onClick={() => patchSearch({ view: 'active', page: 1 })}
            >
              <h1 id="termination-heading">离职中的员工</h1>
            </button>
            <button
              className={`blacklist-heading-tab${view === 'completed' ? ' is-active' : ''}`}
              type="button"
              onClick={() => patchSearch({ view: 'completed', page: 1 })}
            >
              已完成的离职
            </button>
            <button
              className={`blacklist-heading-tab${view === 'all' ? ' is-active' : ''}`}
              type="button"
              onClick={() => patchSearch({ view: 'all', page: 1 })}
            >
              全部离职记录
            </button>
          </nav>
        </div>
      </header>

      {terminations.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="离职管理加载失败"
          description={terminations.error.message}
          action={<Button size="small" onClick={() => terminations.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar termination-filter-toolbar">
          <div className="termination-filter-controls">
            <Input.Search
              className="termination-keyword-input"
              allowClear
              key={query.keyword ?? ''}
              defaultValue={query.keyword}
              aria-label="搜索离职记录"
              placeholder="搜索姓名或工号"
              onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
            />
            <Select
              className="termination-status-select"
              allowClear
              aria-label="筛选离职状态"
              placeholder="离职状态"
              options={statusOptions}
              value={query.status}
              onChange={(status) => patchSearch({ status, page: 1 })}
            />
            <DatePicker.RangePicker
              aria-label="筛选最后工作日"
              value={query.lastWorkingDateFrom && query.lastWorkingDateTo
                ? [dayjs(query.lastWorkingDateFrom), dayjs(query.lastWorkingDateTo)]
                : null}
              onChange={(_, dates) => patchSearch({
                lastWorkingDateFrom: dates[0] || undefined,
                lastWorkingDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
          </div>
          <Typography.Text type="secondary">共 {terminations.data?.meta.total ?? 0} 条</Typography.Text>
        </div>

        <Table<TerminationListItem>
          className="employee-table termination-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={terminations.isLoading}
          columns={terminationColumns}
          dataSource={terminations.data?.data ?? []}
          scroll={{ x: 1_850 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的离职记录" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: terminations.data?.meta.total ?? 0,
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
