import { EyeOutlined, UserSwitchOutlined } from '@ant-design/icons';
import type { ProcessStatus, TrialPostListItem, TrialPostListQuery } from '@hr-demo/shared';
import { Alert, Button, DatePicker, Empty, Input, Select, Table, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTrialPosts } from '../../features/employment/api';

const statusLabels: Record<ProcessStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
  IN_PROGRESS: '进行中',
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

function TrialPostStatusCell({ status }: { status: ProcessStatus }) {
  const color = status === 'APPROVED' || status === 'COMPLETED'
    ? 'success'
    : status === 'REJECTED' || status === 'CANCELLED'
      ? 'error'
      : status === 'PENDING' || status === 'IN_PROGRESS'
        ? 'processing'
        : 'default';
  return <Tag color={color}>{statusLabels[status]}</Tag>;
}

export const trialPostColumns: ColumnsType<TrialPostListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: displayValue },
  { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left', render: displayValue },
  { title: '试岗开始日期', dataIndex: 'startDate', width: 140, render: displayValue },
  { title: '试岗结束日期', dataIndex: 'endDate', width: 140, render: displayValue },
  { title: '调动类型', dataIndex: 'movementTypeName', width: 130, render: displayValue },
  { title: '试岗部门', dataIndex: 'departmentName', width: 180, render: displayValue },
  { title: '试岗职务', dataIndex: 'jobTitleName', width: 150, render: displayValue },
  { title: '考核结果', dataIndex: 'result', width: 140, render: displayValue },
  { title: '试岗状态', dataIndex: 'status', width: 120, render: (status) => <TrialPostStatusCell status={status} /> },
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

export function TrialPostManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<TrialPostListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    status: (searchParams.get('status') as ProcessStatus | null) ?? undefined,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    endDateFrom: searchParams.get('endDateFrom') || undefined,
    endDateTo: searchParams.get('endDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const trialPosts = useTrialPosts(query);

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
    <section className="employee-list-page trial-post-management-page" aria-labelledby="trial-post-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <h1 id="trial-post-heading">试岗期管理</h1>
        </div>
      </header>

      {trialPosts.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="试岗期管理加载失败"
          description={trialPosts.error.message}
          action={<Button size="small" onClick={() => trialPosts.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar trial-post-filter-toolbar">
          <div className="trial-post-filter-controls">
            <Input.Search
              className="trial-post-keyword-input"
              allowClear
              value={query.keyword ?? ''}
              aria-label="搜索试岗记录"
              placeholder="搜索姓名或工号"
              onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
            />
            <Select
              className="trial-post-status-select"
              allowClear
              aria-label="筛选试岗状态"
              placeholder="试岗状态"
              options={statusOptions}
              value={query.status}
              onChange={(status) => patchSearch({ status, page: 1 })}
            />
            <DatePicker.RangePicker
              aria-label="筛选试岗开始日期"
              value={query.startDateFrom && query.startDateTo
                ? [dayjs(query.startDateFrom), dayjs(query.startDateTo)]
                : null}
              onChange={(_, dates) => patchSearch({
                startDateFrom: dates[0] || undefined,
                startDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
            <DatePicker.RangePicker
              aria-label="筛选试岗结束日期"
              value={query.endDateFrom && query.endDateTo
                ? [dayjs(query.endDateFrom), dayjs(query.endDateTo)]
                : null}
              onChange={(_, dates) => patchSearch({
                endDateFrom: dates[0] || undefined,
                endDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
          </div>
          <Typography.Text type="secondary">共 {trialPosts.data?.meta.total ?? 0} 条</Typography.Text>
        </div>

        <Table<TrialPostListItem>
          className="employee-table trial-post-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={trialPosts.isLoading}
          columns={trialPostColumns}
          dataSource={trialPosts.data?.data ?? []}
          scroll={{ x: 1_450 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的试岗记录" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: trialPosts.data?.meta.total ?? 0,
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
