import {
  DownloadOutlined,
  EyeOutlined,
  PlusOutlined,
  StopOutlined,
  UploadOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type {
  EmploymentApprovalSummary,
  EmploymentViewCountKey,
  PartTimeRecordItem,
  PartTimeRecordListQuery,
  PartTimeRecordStatus,
  PartTimeRecordView,
  ProcessStatus,
} from '@hr-demo/shared';
import { Alert, Button, DatePicker, Empty, Input, Modal, Select, Space, Table } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import { useAllEmployees, useEmployeeFormOptions, useOrganizations } from '../../features/employees/api';
import { PartTimeRecordDrawer } from '../../features/employment-foundation/PartTimeRecordDrawer';
import {
  useEmploymentViewCounts,
  usePartTimeRecords,
} from '../../features/employment-foundation/api';

const partTimeViewItems: Array<{ view: PartTimeRecordView; label: string }> = [
  { view: 'active', label: '兼职中' },
  { view: 'expiring', label: '即将到期' },
  { view: 'not_started', label: '未开始' },
  { view: 'ended', label: '已结束' },
  { view: 'approval', label: '审批中的兼职' },
  { view: 'all', label: '全部兼职记录' },
];

const viewCountKeys: Record<PartTimeRecordView, EmploymentViewCountKey> = {
  active: 'part-time.active',
  expiring: 'part-time.expiring',
  not_started: 'part-time.not_started',
  ended: 'part-time.ended',
  approval: 'part-time.approval',
  all: 'part-time.all',
};

const partTimeStatusLabels: Record<PartTimeRecordStatus, string> = {
  DRAFT: '草稿',
  PENDING: '审批中',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
  PENDING_EFFECTIVE: '待生效',
  ACTIVE: '任职中',
  ENDED: '任职结束',
  CANCELLED: '已取消',
};

const approvalStatusLabels: Record<ProcessStatus, string> = {
  DRAFT: '草稿',
  PENDING: '审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
  IN_PROGRESS: '审批中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const disabledActionReasons = {
  directCreate: '直接新增兼职暂不可用：兼职职责必须通过申请审批流程提交',
  batchEnd: '批量结束兼职暂不可用：当前仅支持单条记录结束',
  export: '兼职记录导出暂不可用：导出接口尚未接入',
  import: '兼职记录导入暂不可用：导入接口尚未接入',
} as const;

type PartTimeEmployee = { id: string; employeeNo: string; name: string | null };
type DrawerState = { employee: PartTimeEmployee; recordId?: string };

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function approvalDisplay(approval: EmploymentApprovalSummary | null) {
  if (!approval) return '--';
  const label = approvalStatusLabels[approval.status] ?? approval.status;
  return approval.currentApproverName ? `${label}（${approval.currentApproverName}）` : label;
}

function createPartTimeColumns(onViewRecord?: (record: PartTimeRecordItem) => void): ColumnsType<PartTimeRecordItem> {
  return [
    {
      title: '姓名',
      dataIndex: ['employee', 'name'],
      width: 120,
      fixed: 'left',
      render: (value: string | null) => displayValue(value),
    },
    {
      title: '工号',
      dataIndex: ['employee', 'employeeNo'],
      width: 120,
      fixed: 'left',
      render: (value: string | null) => displayValue(value),
    },
    { title: '兼职类型', dataIndex: 'type', width: 130, render: displayValue },
    { title: '兼职开始日期', dataIndex: 'startDate', width: 150, render: displayValue },
    { title: '兼职机构', dataIndex: 'institution', width: 160, render: displayValue },
    {
      title: '兼职部门',
      dataIndex: ['organization', 'name'],
      width: 160,
      render: (value: string | null) => displayValue(value),
    },
    {
      title: '兼职直线经理',
      dataIndex: ['managerEmployee', 'name'],
      width: 150,
      render: (value: string | null) => displayValue(value),
    },
    {
      title: '兼职职务',
      dataIndex: ['jobTitle', 'name'],
      width: 150,
      render: (value: string | null) => displayValue(value),
    },
    { title: '兼职结束日期', dataIndex: 'endDate', width: 150, render: displayValue },
    {
      title: '任职状态',
      dataIndex: 'status',
      width: 120,
      render: (status: PartTimeRecordStatus) => partTimeStatusLabels[status] ?? status,
    },
    {
      title: '审批状态',
      dataIndex: 'approval',
      width: 180,
      render: (approval: EmploymentApprovalSummary | null) => approvalDisplay(approval),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 130,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          aria-label={`查看兼职记录 ${record.employee.employeeNo}`}
          onClick={() => onViewRecord?.(record)}
          disabled={!onViewRecord}
        >
          查看详情
        </Button>
      ),
    },
  ];
}

export const partTimeColumns: ColumnsType<PartTimeRecordItem> = createPartTimeColumns();

function isPartTimeView(value: string | null): value is PartTimeRecordView {
  return partTimeViewItems.some((item) => item.view === value);
}

export function PartTimeManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const view: PartTimeRecordView = isPartTimeView(rawView) ? rawView : 'active';
  const page = positiveInt(searchParams.get('page'), 1);
  const pageSize = positiveInt(searchParams.get('pageSize'), 10);
  const keyword = searchParams.get('keyword') || undefined;
  const organizationId = searchParams.get('organizationId') || undefined;
  const query = useMemo<PartTimeRecordListQuery>(() => ({
    view,
    ...(keyword ? { keyword } : {}),
    ...(organizationId ? { organizationId } : {}),
    page,
    pageSize,
  }), [keyword, organizationId, page, pageSize, view]);
  const countsQuery = useMemo(
    () => (organizationId ? { organizationId } : {}),
    [organizationId],
  );

  const records = usePartTimeRecords(query);
  const viewCounts = useEmploymentViewCounts(countsQuery);
  const organizations = useOrganizations();
  const formOptions = useEmployeeFormOptions();
  const employees = useAllEmployees({});
  const [keywordInput, setKeywordInput] = useState(keyword ?? '');
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>();
  const [applicationError, setApplicationError] = useState<string>();
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null);

  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const countForView = (targetView: PartTimeRecordView) => {
    const item = viewCounts.data?.items.find(({ key }) => key === viewCountKeys[targetView]);
    if (!item) return '—';
    if (!item.supported || item.count === null) return '--';
    return item.count;
  };

  const selectedEmployee = (employees.data?.data ?? []).find(({ id }) => id === selectedEmployeeId);
  const openApplication = () => {
    setApplicationError(undefined);
    setSelectedEmployeeId(undefined);
    setApplicationOpen(true);
  };
  const continueApplication = () => {
    if (!selectedEmployee) {
      setApplicationError('请选择申请员工');
      return;
    }
    setApplicationOpen(false);
    setDrawerState({
      employee: {
        id: selectedEmployee.id,
        employeeNo: selectedEmployee.employeeNo,
        name: selectedEmployee.name,
      },
    });
  };

  const employeeOptions = (employees.data?.data ?? []).map((employee) => ({
    value: employee.id,
    label: `${employee.name}（${employee.employeeNo}）`,
  }));
  const recordsError = records.error instanceof Error ? records.error.message : '暂时无法加载兼职记录。';
  const organizationsError = organizations.error instanceof Error ? organizations.error.message : '暂时无法加载部门选项。';

  return (
    <section className="employee-list-page employment-reference-page part-time-management-page" aria-labelledby="part-time-heading">
      <header className="employee-page-heading employment-reference-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <h1 id="part-time-heading">兼职管理</h1>
        </div>
        <div className="employment-reference-actions part-time-management-actions" aria-label="兼职管理操作">
          <Button aria-label="新增兼职" type="primary" icon={<PlusOutlined />} disabled title={disabledActionReasons.directCreate}>新增兼职</Button>
          <Button aria-label="新增兼职申请" icon={<PlusOutlined />} onClick={openApplication}>新增兼职申请</Button>
          <Button aria-label="批量结束兼职" icon={<StopOutlined />} disabled title={disabledActionReasons.batchEnd}>批量结束兼职</Button>
          <Button aria-label="导出" icon={<DownloadOutlined />} disabled title={disabledActionReasons.export}>导出</Button>
          <Button aria-label="导入兼职记录" icon={<UploadOutlined />} disabled title={disabledActionReasons.import}>导入兼职记录</Button>
        </div>
      </header>

      <nav className="employment-reference-tabs employment-reference-dashboard part-time-management-dashboard" aria-label="兼职管理视图">
        {partTimeViewItems.map((item) => {
          const countItem = viewCounts.data?.items.find(({ key }) => key === viewCountKeys[item.view]);
          const reason = countItem?.reason ?? (item.view === 'expiring' ? '按兼职结束日期未来 30 日内统计' : undefined);
          return (
            <button
              className={`employment-reference-tab employment-reference-dashboard-item${view === item.view ? ' is-active' : ''}`}
              key={item.view}
              type="button"
              title={reason}
              onClick={() => patchSearch({ view: item.view === 'active' ? undefined : item.view, page: 1 })}
            >
              <span className="employment-reference-dashboard-label">{item.label}</span>
              <strong className="employment-reference-dashboard-count">{countForView(item.view)}</strong>
            </button>
          );
        })}
      </nav>

      {records.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="兼职管理加载失败"
          description={recordsError}
          action={<Button size="small" onClick={() => records.refetch()}>重试</Button>}
        />
      ) : null}
      {viewCounts.isError ? (
        <Alert
          className="content-alert"
          type="warning"
          showIcon
          message="兼职视图计数加载失败"
          description={viewCounts.error instanceof Error ? viewCounts.error.message : '暂时无法加载视图计数。'}
          action={<Button size="small" onClick={() => viewCounts.refetch()}>重试</Button>}
        />
      ) : null}
      {organizations.isError ? (
        <Alert
          className="content-alert"
          type="warning"
          showIcon
          message="部门筛选加载失败"
          description={organizationsError}
          action={<Button size="small" onClick={() => organizations.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar employment-reference-filter-toolbar part-time-filter-toolbar">
          <div className="employment-reference-filter-controls part-time-filter-controls">
            <Input.Search
              className="part-time-keyword-input"
              allowClear
              value={keywordInput}
              aria-label="筛选人员"
              placeholder="人员"
              onChange={(event) => {
                setKeywordInput(event.target.value);
                if (!event.target.value) patchSearch({ keyword: undefined, page: 1 });
              }}
              onSearch={(value) => patchSearch({ keyword: value.trim() || undefined, page: 1 })}
            />
            <OrganizationTreeSelect
              className="part-time-department-select"
              allowClear
              aria-label="筛选兼职部门"
              placeholder="兼职部门"
              loading={organizations.isLoading}
              organizations={organizations.data ?? []}
              value={organizationId}
              onChange={(value) => patchSearch({ organizationId: value, page: 1 })}
            />
            <DatePicker.RangePicker
              aria-label="筛选兼职开始日期"
              disabled
              allowEmpty={[true, true]}
              placeholder={['兼职开始日期', '兼职开始日期']}
              value={[
                searchParams.get('startDateFrom') ? dayjs(searchParams.get('startDateFrom')) : null,
                searchParams.get('startDateTo') ? dayjs(searchParams.get('startDateTo')) : null,
              ]}
            />
          </div>
        </div>

        <Table<PartTimeRecordItem>
          className="employee-table employment-reference-table part-time-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={records.isLoading}
          columns={createPartTimeColumns((record) => setDrawerState({
            recordId: record.id,
            employee: record.employee,
          }))}
          dataSource={records.data?.data ?? []}
          scroll={{ x: 1_850 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`没有符合条件的${view === 'active' ? '当前' : partTimeViewItems.find((item) => item.view === view)?.label ?? ''}兼职记录`} /> }}
          pagination={{
            current: page,
            pageSize,
            total: records.data?.meta.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
          }}
          onChange={(pagination: TablePaginationConfig) => patchSearch({
            page: pagination.current ?? 1,
            pageSize: pagination.pageSize ?? 10,
          })}
        />
      </div>

      <Modal
        title="新增兼职申请"
        open={applicationOpen}
        onCancel={() => setApplicationOpen(false)}
        footer={(
          <Space>
            <Button onClick={() => setApplicationOpen(false)}>取消</Button>
            <Button type="primary" onClick={continueApplication}>继续</Button>
          </Space>
        )}
        destroyOnHidden
      >
        <Select
          aria-label="申请员工"
          showSearch
          optionFilterProp="label"
          placeholder="请选择申请员工"
          loading={employees.isLoading}
          options={employeeOptions}
          value={selectedEmployeeId}
          onChange={(value) => {
            setSelectedEmployeeId(value);
            setApplicationError(undefined);
          }}
          style={{ width: '100%' }}
        />
        {employees.isError ? <Alert type="error" showIcon message="员工选项加载失败" description={employees.error instanceof Error ? employees.error.message : '暂时无法加载员工选项。'} /> : null}
        {applicationError ? <Alert type="error" showIcon message={applicationError} /> : null}
      </Modal>

      {drawerState ? (
        <PartTimeRecordDrawer
          open
          recordId={drawerState.recordId}
          onClose={() => setDrawerState(null)}
          onSuccess={() => {
            setDrawerState(null);
            void records.refetch();
          }}
          employee={drawerState.employee}
          organizations={organizations.data ?? []}
          jobTitles={formOptions.data?.jobTitles ?? []}
          managers={formOptions.data?.managers ?? []}
        />
      ) : null}
    </section>
  );
}
