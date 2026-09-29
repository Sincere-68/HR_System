import {
  ClearOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  ProfileOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type {
  AssignmentStatus,
  EmploymentRecordListItem,
  EmploymentRecordListQuery,
  EmploymentRecordListView,
  EmploymentStatus,
} from '@hr-demo/shared';
import { Alert, Button, DatePicker, Descriptions, Drawer, Empty, Input, Select, Table, Tag } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import { useOrganizations } from '../../features/employees/api';
import { useEmploymentRecords } from '../../features/employment/api';
import { apiRequest } from '../../lib/api';

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

const personnelStatusOptions = Object.entries(personnelStatusLabels)
  .map(([value, label]) => ({ value, label }));

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function isView(value: string | null): value is EmploymentRecordListView {
  return value === 'current' || value === 'history';
}

function PlaceholderCell() {
  return <span>--</span>;
}

type EmploymentRecordDetail = {
  id?: string;
  employeeName?: string | null;
  organization?: { name?: string | null } | null;
  position?: { name?: string | null } | null;
  assignmentStatus?: AssignmentStatus | null;
};

function createEmploymentRecordColumns(
  view: EmploymentRecordListView,
  onHistoryDetail?: (record: EmploymentRecordListItem) => void,
): ColumnsType<EmploymentRecordListItem> {
  return [
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
      width: 120,
      render: (_, record) => view === 'history' ? (
        <span>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            aria-label={`查看任职记录 ${record.employeeNo}`}
            onClick={() => onHistoryDetail?.(record)}
          >
            查看任职记录
          </Button>
          {record.canViewEmployeeDetail ? (
            <Link to={`/personnel/employees/${record.employeeId}`}>
              <Button type="link" size="small">当前详情</Button>
            </Link>
          ) : <Button type="link" size="small" disabled aria-label="暂无当前详情">暂无详情</Button>}
        </span>
      ) : record.canViewEmployeeDetail ? (
        <Link to={`/personnel/employees/${record.employeeId}`}>
          <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
        </Link>
      ) : <Button type="link" size="small" disabled>暂无详情</Button>,
    },
  ];
}

export const employmentRecordColumns = createEmploymentRecordColumns('current');

export function EmploymentRecordsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const view: EmploymentRecordListView = isView(rawView) ? rawView : 'current';
  const query = useMemo<EmploymentRecordListQuery>(() => ({
    view,
    keyword: searchParams.get('keyword') || undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    personnelStatus: (searchParams.get('personnelStatus') as EmploymentStatus | null) ?? undefined,
    assignmentStatus: (searchParams.get('assignmentStatus') as AssignmentStatus | null) ?? undefined,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams, view]);
  const records = useEmploymentRecords(query);
  const organizations = useOrganizations();
  const [keywordInput, setKeywordInput] = useState(query.keyword ?? '');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [historyDetailRecord, setHistoryDetailRecord] = useState<EmploymentRecordListItem | null>(null);
  const [historyDetail, setHistoryDetail] = useState<EmploymentRecordDetail | null>(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [historyDetailError, setHistoryDetailError] = useState<string | null>(null);

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

  const changeView = (nextView: EmploymentRecordListView) => {
    patchSearch({ view: nextView, page: 1 });
  };

  const openHistoryDetail = (record: EmploymentRecordListItem) => {
    setHistoryDetailRecord(record);
    setHistoryDetail(null);
    setHistoryDetailError(null);
    setHistoryDetailLoading(true);
    void apiRequest<EmploymentRecordDetail>(`/employment/records/${encodeURIComponent(record.id)}`)
      .then(setHistoryDetail)
      .catch((error: Error) => setHistoryDetailError(error.message))
      .finally(() => setHistoryDetailLoading(false));
  };

  const clearFilters = () => {
    patchSearch({
      keyword: undefined,
      organizationId: undefined,
      personnelStatus: undefined,
      assignmentStatus: undefined,
      startDateFrom: undefined,
      startDateTo: undefined,
      page: 1,
    });
  };

  return (
    <section className="employee-list-page employment-reference-page employment-records-page" aria-labelledby="employment-records-heading">
      <header className="employee-page-heading employment-reference-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><ProfileOutlined /></span>
          <h1 id="employment-records-heading">任职记录</h1>
          <nav className="blacklist-heading-tabs" aria-label="任职记录视图">
            <button
              className={`blacklist-heading-tab${view === 'current' ? ' is-active' : ''}`}
              type="button"
              aria-current={view === 'current' ? 'page' : undefined}
              onClick={() => changeView('current')}
            >
              当前有效
            </button>
            <button
              className={`blacklist-heading-tab${view === 'history' ? ' is-active' : ''}`}
              type="button"
              aria-current={view === 'history' ? 'page' : undefined}
              onClick={() => changeView('history')}
            >
              完整历史
            </button>
          </nav>
        </div>
        <div className="employment-reference-actions employment-records-actions" aria-label="任职记录操作">
          <Button aria-label="导入" icon={<UploadOutlined />} disabled>导入</Button>
          <Button aria-label="批量编辑" icon={<EditOutlined />} disabled>批量编辑</Button>
          <Button aria-label="导出" icon={<DownloadOutlined />} disabled>导出</Button>
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
        <div className="employee-filter-toolbar employment-reference-filter-toolbar employment-records-filter-toolbar">
          <div className="employment-reference-filter-controls employment-records-filter-controls">
            <Input.Search
              className="employment-records-keyword-input"
              allowClear
              value={keywordInput}
              aria-label="筛选姓名"
              placeholder="姓名"
              onChange={(event) => {
                setKeywordInput(event.target.value);
                if (!event.target.value) patchSearch({ keyword: undefined, page: 1 });
              }}
              onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
            />
            <Input
              className="employment-records-email-input employment-reference-unavailable-filter"
              aria-label="筛选电子邮件"
              placeholder="电子邮件"
              disabled
            />
            <Select
              className="employment-records-assignment-select"
              allowClear
              aria-label="筛选任职状态"
              placeholder="任职状态"
              value={query.assignmentStatus}
              options={Object.entries(assignmentStatusLabels).map(([value, label]) => ({ value, label }))}
              onChange={(assignmentStatus) => patchSearch({ assignmentStatus, page: 1 })}
            />
            <Select
              className="employment-records-business-select employment-reference-unavailable-filter"
              aria-label="筛选业务类型"
              placeholder="业务类型"
              disabled
            />
            <OrganizationTreeSelect
              allowClear
              aria-label="筛选任职部门"
              className="department-filter-tree-select employment-records-department-select"
              placeholder="任职部门"
              loading={organizations.isLoading}
              value={query.organizationId}
              organizations={organizations.data ?? []}
              onChange={(organizationId) => patchSearch({ organizationId, page: 1 })}
            />
            <Select
              className="employment-records-approval-select employment-reference-unavailable-filter"
              aria-label="筛选审批状态"
              placeholder="审批状态"
              disabled
            />
            <Select
              className="employment-records-current-select employment-reference-unavailable-filter"
              aria-label="筛选是否当前生效"
              placeholder="是否当前生效"
              disabled
            />
            <Button
              type="link"
              icon={<FilterOutlined />}
              aria-label="高级筛选"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              高级筛选
            </Button>
            <Button type="link" icon={<ClearOutlined />} aria-label="清空" onClick={clearFilters}>
              清空
            </Button>
            {advancedOpen ? (
              <div className="employment-records-advanced-filters">
                <Select
                  allowClear
                  aria-label="筛选人员状态"
                  placeholder="人员状态"
                  options={personnelStatusOptions}
                  value={query.personnelStatus}
                  onChange={(personnelStatus) => patchSearch({ personnelStatus, page: 1 })}
                />
                <DatePicker.RangePicker
                  aria-label="筛选现岗位开始日期"
                  placeholder={['现岗位开始日期', '现岗位开始日期']}
                  value={[
                    query.startDateFrom ? dayjs(query.startDateFrom) : null,
                    query.startDateTo ? dayjs(query.startDateTo) : null,
                  ]}
                  onChange={(_, dates) => patchSearch({
                    startDateFrom: dates[0] || undefined,
                    startDateTo: dates[1] || undefined,
                    page: 1,
                  })}
                />
              </div>
            ) : null}
          </div>
        </div>

        <Table<EmploymentRecordListItem>
          className="employee-table employment-reference-table employment-records-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={records.isLoading}
          columns={createEmploymentRecordColumns(view, openHistoryDetail)}
          dataSource={records.data?.data ?? []}
          scroll={{ x: 2_050 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的任职记录" /> }}
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

      <Drawer
        title="任职记录详情"
        open={Boolean(historyDetailRecord)}
        onClose={() => setHistoryDetailRecord(null)}
        width={420}
      >
        {historyDetailLoading ? <span>加载中...</span> : null}
        {historyDetailError ? <Alert type="error" message={historyDetailError} /> : null}
        {historyDetail ? (
          <>
            <div>只读详情</div>
            <Descriptions column={1}>
              <Descriptions.Item label="姓名">{displayValue(historyDetail.employeeName)}</Descriptions.Item>
              <Descriptions.Item label="任职部门">{displayValue(historyDetail.organization?.name)}</Descriptions.Item>
              <Descriptions.Item label="任职职位">{displayValue(historyDetail.position?.name)}</Descriptions.Item>
              <Descriptions.Item label="任职状态">{historyDetail.assignmentStatus ? assignmentStatusLabels[historyDetail.assignmentStatus] : '--'}</Descriptions.Item>
            </Descriptions>
          </>
        ) : null}
      </Drawer>
    </section>
  );
}
