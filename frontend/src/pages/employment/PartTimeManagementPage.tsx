import { EyeOutlined, UserSwitchOutlined } from '@ant-design/icons';
import type {
  AssignmentStatus,
  AssignmentType,
  PartTimeListItem,
  PartTimeListQuery,
} from '@hr-demo/shared';
import { Alert, Button, DatePicker, Empty, Input, Select, Table, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePartTimeAssignments } from '../../features/employment/api';

const assignmentTypeOptions: Array<{ value: AssignmentType; label: string }> = [
  { value: 'PRIMARY', label: '主要任职' },
  { value: 'ADDITIONAL', label: '附加任职' },
  { value: 'TEMPORARY', label: '临时任职' },
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
  { title: '兼职类型', dataIndex: 'partTimeType', width: 130, render: displayValue },
  { title: '兼职开始日期', dataIndex: 'startDate', width: 150, render: displayValue },
  { title: '兼职机构', dataIndex: 'institutionName', width: 160, render: displayValue },
  { title: '兼职部门', dataIndex: 'departmentName', width: 160, render: displayValue },
  { title: '兼职直线经理', dataIndex: 'managerName', width: 150, render: displayValue },
  { title: '兼职职务', dataIndex: 'jobTitleName', width: 150, render: displayValue },
  { title: '兼职结束日期', dataIndex: 'endDate', width: 150, render: displayValue },
  {
    title: '任职状态',
    dataIndex: 'assignmentStatus',
    width: 120,
    render: (status: AssignmentStatus | null) => status ? assignmentStatusLabels[status] : '--',
  },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: displayValue },
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

export function PartTimeManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<PartTimeListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    assignmentType: (searchParams.get('assignmentType') as AssignmentType | null) ?? undefined,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    endDateFrom: searchParams.get('endDateFrom') || undefined,
    endDateTo: searchParams.get('endDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const partTimeAssignments = usePartTimeAssignments(query);
  const [keywordInput, setKeywordInput] = useState(query.keyword ?? '');
  useEffect(() => setKeywordInput(query.keyword ?? ''), [query.keyword]);

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
    <section className="employee-list-page part-time-management-page" aria-labelledby="part-time-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <h1 id="part-time-heading">兼职管理</h1>
        </div>
      </header>

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
        <div className="employee-filter-toolbar part-time-filter-toolbar">
          <div className="part-time-filter-controls">
            <Input.Search
              className="part-time-keyword-input"
              allowClear
              value={keywordInput}
              aria-label="搜索兼职任职"
              placeholder="搜索姓名或工号"
              onChange={(event) => setKeywordInput(event.target.value)}
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
            <DatePicker.RangePicker
              aria-label="筛选兼职开始日期"
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
              aria-label="筛选兼职结束日期"
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
          <Typography.Text type="secondary">共 {partTimeAssignments.data?.meta.total ?? 0} 条</Typography.Text>
        </div>

        <Table<PartTimeListItem>
          className="employee-table part-time-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={partTimeAssignments.isLoading}
          columns={partTimeColumns}
          dataSource={partTimeAssignments.data?.data ?? []}
          scroll={{ x: 1_700 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的当前兼职任职记录" /> }}
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
    </section>
  );
}
