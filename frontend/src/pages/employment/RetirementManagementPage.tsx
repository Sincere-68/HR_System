import { EyeOutlined, UserSwitchOutlined } from '@ant-design/icons';
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
  Table,
  Typography,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import { useOrganizations } from '../../features/employees/api';
import { useRetirements } from '../../features/employment/api';

const genderLabels: Record<Gender, string> = {
  MALE: '男',
  FEMALE: '女',
  UNDISCLOSED: '保密',
};

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

function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

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

export function RetirementManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<RetirementListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    status: (searchParams.get('status') as ProcessStatus | null) ?? undefined,
    plannedRetirementDateFrom: searchParams.get('plannedRetirementDateFrom') || undefined,
    plannedRetirementDateTo: searchParams.get('plannedRetirementDateTo') || undefined,
    departmentId: searchParams.get('departmentId') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const retirements = useRetirements(query);
  const organizations = useOrganizations();

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
    <section className="employee-list-page retirement-management-page" aria-labelledby="retirement-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <h1 id="retirement-heading">退休管理</h1>
        </div>
      </header>

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

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar retirement-filter-toolbar">
          <div className="retirement-filter-controls">
            <Input.Search
              className="retirement-keyword-input"
              allowClear
              value={query.keyword ?? ''}
              aria-label="搜索退休记录"
              placeholder="搜索姓名或工号"
              onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
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
            <Select
              className="retirement-status-select"
              allowClear
              aria-label="筛选退休状态"
              placeholder="退休状态"
              options={statusOptions}
              value={query.status}
              onChange={(status) => patchSearch({ status, page: 1 })}
            />
            <DatePicker.RangePicker
              aria-label="筛选预计退休日期"
              value={query.plannedRetirementDateFrom && query.plannedRetirementDateTo
                ? [dayjs(query.plannedRetirementDateFrom), dayjs(query.plannedRetirementDateTo)]
                : null}
              onChange={(_, dates) => patchSearch({
                plannedRetirementDateFrom: dates[0] || undefined,
                plannedRetirementDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
          </div>
          <Typography.Text type="secondary">共 {retirements.data?.meta.total ?? 0} 条</Typography.Text>
        </div>

        <Table<RetirementListItem>
          className="employee-table retirement-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={retirements.isLoading}
          columns={retirementColumns}
          dataSource={retirements.data?.data ?? []}
          scroll={{ x: 1_250 }}
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
    </section>
  );
}
