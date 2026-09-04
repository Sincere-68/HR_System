import { EyeOutlined, SwapOutlined } from '@ant-design/icons';
import type {
  EmployeeMovementListItem,
  EmployeeMovementListQuery,
  EmployeeMovementListView,
  ProcessStatus,
} from '@hr-demo/shared';
import { Alert, Button, DatePicker, Empty, Input, Select, Table, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useEmployeeMovements } from '../../features/employment/api';

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

function ApprovalStatusCell({ status }: { status: ProcessStatus | null }) {
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

export const employeeMovementColumns: ColumnsType<EmployeeMovementListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: displayValue },
  { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left', render: displayValue },
  { title: '异动日期', dataIndex: 'effectiveDate', width: 120, render: displayValue },
  { title: '异动类型', dataIndex: 'movementTypeName', width: 130, render: displayValue },
  { title: '异动类型（员工端）', dataIndex: 'movementTypeEmployeeName', width: 170, render: displayValue },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: (status) => <ApprovalStatusCell status={status} /> },
  { title: '调动前部门', dataIndex: 'fromDepartmentName', width: 160, render: displayValue },
  { title: '调动前职位', dataIndex: 'fromPositionName', width: 150, render: displayValue },
  { title: '调动前职级', dataIndex: 'fromJobLevel', width: 130, render: displayValue },
  { title: '调动后部门', dataIndex: 'toDepartmentName', width: 160, render: displayValue },
  { title: '调动后职位', dataIndex: 'toPositionName', width: 150, render: displayValue },
  { title: '调动后职级', dataIndex: 'toJobLevel', width: 130, render: displayValue },
  { title: '调动后工作地点', dataIndex: 'toWorkplaceName', width: 170, render: displayValue },
  { title: '交接状态', dataIndex: 'handoverStatus', width: 120, render: displayValue },
  { title: '当前审批人', dataIndex: 'currentApproverName', width: 140, render: displayValue },
  { title: '试岗结束日期', dataIndex: 'trialPostEndDate', width: 140, render: displayValue },
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

export function EmployeeChangeManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const movementView: EmployeeMovementListView = rawView === 'completed' || rawView === 'all' ? rawView : 'active';
  const query = useMemo<EmployeeMovementListQuery>(() => ({
    view: movementView,
    keyword: searchParams.get('keyword') || undefined,
    approvalStatus: (searchParams.get('approvalStatus') as ProcessStatus | null) ?? undefined,
    effectiveDateFrom: searchParams.get('effectiveDateFrom') || undefined,
    effectiveDateTo: searchParams.get('effectiveDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [movementView, searchParams]);
  const movements = useEmployeeMovements(query);

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
    <section className="employee-list-page employee-change-management-page" aria-labelledby="employee-changes-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><SwapOutlined /></span>
          <nav className="blacklist-heading-tabs" aria-label="异动管理功能">
            <Link className={`blacklist-heading-tab${movementView === 'active' ? ' is-active' : ''}`} to="/employment/changes?view=active">
              <h1 id="employee-changes-heading">异动中员工</h1>
            </Link>
            <Link className={`blacklist-heading-tab${movementView === 'completed' ? ' is-active' : ''}`} to="/employment/changes?view=completed">
              已完成的异动
            </Link>
            <Link className={`blacklist-heading-tab${movementView === 'all' ? ' is-active' : ''}`} to="/employment/changes?view=all">
              全部异动记录
            </Link>
          </nav>
        </div>
      </header>

      {movements.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="异动管理加载失败"
          description={movements.error.message}
          action={<Button size="small" onClick={() => movements.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar employee-change-filter-toolbar">
          <div className="employee-change-filter-controls">
            <Input.Search
              className="employee-change-keyword-input"
              allowClear
              value={query.keyword ?? ''}
              aria-label="搜索异动记录"
              placeholder="搜索姓名或工号"
              onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
            />
            <Select
              className="employee-change-status-select"
              allowClear
              aria-label="筛选审批状态"
              placeholder="审批状态"
              options={statusOptions}
              value={query.approvalStatus}
              onChange={(approvalStatus) => patchSearch({ approvalStatus, page: 1 })}
            />
            <DatePicker.RangePicker
              aria-label="筛选异动日期"
              value={query.effectiveDateFrom && query.effectiveDateTo
                ? [dayjs(query.effectiveDateFrom), dayjs(query.effectiveDateTo)]
                : null}
              onChange={(_, dates) => patchSearch({
                effectiveDateFrom: dates[0] || undefined,
                effectiveDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
          </div>
          <Typography.Text type="secondary">共 {movements.data?.meta.total ?? 0} 条</Typography.Text>
        </div>

        <Table<EmployeeMovementListItem>
          className="employee-table employee-change-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={movements.isLoading}
          columns={employeeMovementColumns}
          dataSource={movements.data?.data ?? []}
          scroll={{ x: 2_450 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的异动记录" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: movements.data?.meta.total ?? 0,
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
