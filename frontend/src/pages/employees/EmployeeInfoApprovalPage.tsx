import { EyeOutlined, SolutionOutlined } from '@ant-design/icons';
import type {
  EmployeeInfoApprovalListItem,
  EmployeeInfoApprovalListQuery,
  ProcessStatus,
} from '@hr-demo/shared';
import { Alert, Button, Empty, Table, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useEmployeeInfoApprovals, useOrganizations } from '../../features/employees/api';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';

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

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
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

export function EmployeeInfoApprovalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const approvalView = searchParams.get('view') === 'personal' ? 'personal' : 'employment';
  const query = useMemo<EmployeeInfoApprovalListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    departmentId: searchParams.get('departmentId') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const approvals = useEmployeeInfoApprovals(query);
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

  const columns: ColumnsType<EmployeeInfoApprovalListItem> = [
    {
      title: '人员',
      dataIndex: 'employeeName',
      width: 140,
      render: (value, record) => record.employeeId && record.canViewEmployeeDetail
        ? <Link to={`/personnel/employees/${record.employeeId}`}>{displayValue(value)}</Link>
        : displayValue(value),
    },
    { title: '部门', dataIndex: 'departmentName', width: 160, render: displayValue },
    { title: '信息采集活动名称', dataIndex: 'activityName', width: 220, render: displayValue },
    { title: '发起人', dataIndex: 'applicantName', width: 140, render: displayValue },
    { title: '发起时间', dataIndex: 'submittedAt', width: 180, render: formatDateTime },
    { title: '信息采集状态', dataIndex: 'status', width: 140, render: (status) => <StatusCell status={status} /> },
    { title: '当前审批人', dataIndex: 'currentApproverName', width: 140, render: displayValue },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 100,
      render: (_, record) => record.employeeId && record.canViewEmployeeDetail ? (
        <Link to={`/personnel/employees/${record.employeeId}`}>
          <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
        </Link>
      ) : (
        <Button type="link" size="small" disabled title="该审批记录未关联员工主档案">暂无详情</Button>
      ),
    },
  ];

  const organizationLoadError = organizations.isError;

  return (
    <section className="employee-list-page employee-info-approval-page" aria-labelledby="employee-info-approval-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><SolutionOutlined /></span>
          <nav className="blacklist-heading-tabs" aria-label="员工信息审批功能">
            <Link
              className={`blacklist-heading-tab${approvalView === 'employment' ? ' is-active' : ''}`}
              to="/personnel/approval?view=employment"
            >
              <h1 id="employee-info-approval-heading">在职信息采集</h1>
            </Link>
            <Link
              className={`blacklist-heading-tab${approvalView === 'personal' ? ' is-active' : ''}`}
              to="/personnel/approval?view=personal"
            >
              个人信息变更
            </Link>
          </nav>
        </div>
      </header>

      {approvals.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="员工信息审批加载失败"
          description={approvals.error.message}
          action={<Button size="small" onClick={() => approvals.refetch()}>重试</Button>}
        />
      ) : null}
      {organizationLoadError ? (
        <Alert
          className="content-alert"
          type="warning"
          showIcon
          message="部门筛选加载失败"
          description={organizations.error instanceof Error ? organizations.error.message : '暂时无法加载部门选项，列表仍可正常使用。'}
          action={<Button size="small" onClick={() => organizations.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar">
          <div className="employee-filter-controls">
            <OrganizationTreeSelect
              aria-label="筛选部门"
              className="department-filter-tree-select"
              variant="borderless"
              allowClear
              organizations={organizations.data ?? []}
              placeholder="部门"
              value={query.departmentId}
              onChange={(departmentId) => patchSearch({ departmentId, page: 1 })}
            />
          </div>
          <Typography.Text type="secondary">共 {approvals.data?.meta.total ?? 0} 条</Typography.Text>
        </div>

        <Table<EmployeeInfoApprovalListItem>
          className="employee-table employee-info-approval-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={approvals.isLoading}
          columns={columns}
          dataSource={approvals.data?.data ?? []}
          scroll={{ x: 1_220 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的审批记录" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: approvals.data?.meta.total ?? 0,
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
