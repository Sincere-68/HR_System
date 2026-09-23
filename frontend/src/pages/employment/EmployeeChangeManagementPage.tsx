import { DownOutlined, EyeOutlined, SwapOutlined } from '@ant-design/icons';
import type {
  EmployeeMovementListItem,
  EmployeeMovementListQuery,
  EmployeeMovementListView,
  ProcessStatus,
} from '@hr-demo/shared';
import { Alert, Button, DatePicker, Empty, Input, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';

function isForbiddenError(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error
    && (error as { status?: number }).status === 403;
}
import { useEffect, useMemo, useState } from 'react';
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
  {
    title: '姓名',
    dataIndex: 'employeeName',
    width: 120,
    fixed: 'left',
    render: (value, record) => record.canViewEmployeeDetail ? (
      <Link to={`/personnel/employees/${record.employeeId}`}>{displayValue(value)}</Link>
    ) : displayValue(value),
  },
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
  const [keywordInput, setKeywordInput] = useState('');
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

  useEffect(() => {
    setKeywordInput(query.keyword ?? '');
  }, [query.keyword]);

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
  const changeView = (view: EmployeeMovementListView) => {
    patchSearch({ view, page: 1 });
  };

  return (
    <section
      className="employee-list-page employee-change-management-page employment-reference-page employment-reference-page--changes"
      aria-labelledby="employee-changes-heading"
    >
      <header className="employee-page-heading employment-reference-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><SwapOutlined /></span>
          <nav className="blacklist-heading-tabs employment-reference-tabs" aria-label="异动管理功能">
            <button
              className={`blacklist-heading-tab employment-reference-tab${movementView === 'active' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('active')}
            >
              <h1 id="employee-changes-heading">异动中员工</h1>
            </button>
            <button
              className={`blacklist-heading-tab employment-reference-tab${movementView === 'completed' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('completed')}
            >
              已完成的异动
            </button>
            <button
              className={`blacklist-heading-tab employment-reference-tab${movementView === 'all' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('all')}
            >
              全部异动记录
            </button>
          </nav>
        </div>
        <Space className="employee-change-actions employment-reference-actions" size={8}>
          <Button type="primary" disabled>异动申请</Button>
          <Button disabled>异动</Button>
          <Button disabled>批量异动</Button>
          <Button disabled>批量异动申请 <DownOutlined /></Button>
          <Button disabled>导出</Button>
        </Space>
      </header>

      <Alert
        className="employee-change-reference-notice employment-reference-notice"
        type="info"
        showIcon
        message={(
          <div>
            <div>1、可在此列表查看调动中的员工，跟踪员工的调动审批进度，也可以使用【催办】、【转交】或者【撤销】按钮直接对调动流程进行干预。</div>
            <div>2、员工的部门、汇报线、工作地、职位、职务、职级等任职信息调整，均可通过调动业务实现。</div>
          </div>
        )}
      />

      {movements.isError ? (
        isForbiddenError(movements.error) ? (
          <Alert
            className="content-alert"
            type="warning"
            showIcon
            message="暂无访问权限"
            description="当前账号没有查看异动记录的权限。"
          />
        ) : (
          <Alert
            className="content-alert"
            type="error"
            showIcon
            message="异动管理加载失败"
            description={movements.error.message}
            action={<Button size="small" onClick={() => movements.refetch()}>重试</Button>}
          />
        )
      ) : null}

      <div className="employee-table-surface employment-reference-surface">
        <div className="employee-filter-toolbar employee-change-filter-toolbar employment-reference-filter-toolbar">
          <div className="employee-change-filter-controls employment-reference-filter-controls">
            <Input.Search
              className="employee-change-keyword-input employment-reference-person-filter"
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
            <DatePicker.RangePicker
              className="employee-change-date-filter employment-reference-date-filter"
              aria-label="筛选调动日期"
              placeholder={['调动日期开始', '调动日期结束']}
              value={[
                query.effectiveDateFrom ? dayjs(query.effectiveDateFrom) : null,
                query.effectiveDateTo ? dayjs(query.effectiveDateTo) : null,
              ]}
              onChange={(_, dates) => patchSearch({
                effectiveDateFrom: dates[0] || undefined,
                effectiveDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
            <Select
              className="employee-change-department-filter employment-reference-unavailable-filter"
              aria-label="筛选调动后部门"
              placeholder="调动后部门"
              disabled
            />
            <Select
              className="employee-change-position-filter employment-reference-unavailable-filter"
              aria-label="筛选调动后职务"
              placeholder="调动后职务"
              disabled
            />
            <Select
              className="employee-change-status-select employment-reference-status-filter"
              allowClear
              aria-label="筛选审批状态"
              placeholder="审批状态"
              options={statusOptions}
              value={query.approvalStatus}
              onChange={(approvalStatus) => patchSearch({ approvalStatus, page: 1 })}
            />
            <Button className="employee-change-advanced-filter" type="link" disabled>高级筛选</Button>
          </div>
        </div>

        <Table<EmployeeMovementListItem>
          className="employee-table employee-change-table employment-reference-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={movements.isLoading}
          columns={employeeMovementColumns}
          dataSource={movements.isError ? [] : (movements.data?.data ?? [])}
          scroll={{ x: 2_450 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: movements.isError
            ? null
            : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的异动记录" /> }}
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
