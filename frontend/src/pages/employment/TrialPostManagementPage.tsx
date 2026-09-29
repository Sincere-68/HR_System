import { DownOutlined, EyeOutlined, UserSwitchOutlined } from '@ant-design/icons';
import type { ProcessStatus, TrialPostListItem, TrialPostListQuery } from '@hr-demo/shared';
import { Alert, Button, DatePicker, Empty, Input, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTrialPosts } from '../../features/employment/api';

type TrialPostReferenceView = 'active' | 'evaluating' | 'failed' | 'passed' | 'all';

const statusLabels: Record<ProcessStatus, string> = {
  DRAFT: '试岗中',
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '试岗不通过',
  WITHDRAWN: '已撤回',
  IN_PROGRESS: '考核中',
  COMPLETED: '试岗通过',
  CANCELLED: '已取消',
};

const trialPostViewStatuses: Record<TrialPostReferenceView, ProcessStatus | undefined> = {
  active: 'DRAFT',
  evaluating: 'IN_PROGRESS',
  failed: 'REJECTED',
  passed: 'COMPLETED',
  all: undefined,
};

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isTrialPostReferenceView(value: string | null): value is TrialPostReferenceView {
  return value === 'active'
    || value === 'evaluating'
    || value === 'failed'
    || value === 'passed'
    || value === 'all';
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
  const [keywordInput, setKeywordInput] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedDraft, setAdvancedDraft] = useState<{ startDateFrom?: string; startDateTo?: string }>({});
  const requestedView = isTrialPostReferenceView(searchParams.get('view'))
    ? searchParams.get('view') as TrialPostReferenceView
    : undefined;
  const trialPostView = requestedView ?? 'active';
  const query = useMemo<TrialPostListQuery>(() => ({
    view: requestedView,
    keyword: searchParams.get('keyword') || undefined,
    status: requestedView
      ? undefined
      : (searchParams.get('status') as ProcessStatus | null) ?? trialPostViewStatuses.active,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    endDateFrom: searchParams.get('endDateFrom') || undefined,
    endDateTo: searchParams.get('endDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [requestedView, searchParams]);
  const trialPosts = useTrialPosts(query);

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
  const changeView = (view: TrialPostReferenceView) => {
    patchSearch({
      view,
      status: view === 'failed' || view === 'passed' ? undefined : trialPostViewStatuses[view],
      page: 1,
    });
  };
  const openAdvancedFilters = () => {
    setAdvancedDraft({
      startDateFrom: query.startDateFrom,
      startDateTo: query.startDateTo,
    });
    setAdvancedOpen(true);
  };
  const cancelAdvancedFilters = () => {
    setAdvancedOpen(false);
    setAdvancedDraft({});
  };
  const applyAdvancedFilters = () => {
    patchSearch({ ...advancedDraft, page: 1 });
    setAdvancedOpen(false);
  };

  return (
    <section
      className="employee-list-page trial-post-management-page employment-reference-page employment-reference-page--trial-post"
      aria-labelledby="trial-post-heading"
    >
      <header className="employee-page-heading employment-reference-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <nav className="blacklist-heading-tabs employment-reference-tabs" aria-label="试岗期管理功能">
            <button
              className={`blacklist-heading-tab employment-reference-tab${trialPostView === 'active' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('active')}
            >
              {trialPostView === 'active' ? <h1 id="trial-post-heading">试岗中人员</h1> : '试岗中人员'}
            </button>
            <button
              className={`blacklist-heading-tab employment-reference-tab${trialPostView === 'evaluating' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('evaluating')}
            >
              {trialPostView === 'evaluating' ? <h1 id="trial-post-heading">考核中</h1> : '考核中'}
            </button>
            <button
              className={`blacklist-heading-tab employment-reference-tab${trialPostView === 'failed' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('failed')}
            >
              {trialPostView === 'failed' ? <h1 id="trial-post-heading">试岗不通过</h1> : '试岗不通过'}
            </button>
            <button
              className={`blacklist-heading-tab employment-reference-tab${trialPostView === 'passed' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('passed')}
            >
              {trialPostView === 'passed' ? <h1 id="trial-post-heading">试岗通过</h1> : '试岗通过'}
            </button>
            <button
              className={`blacklist-heading-tab employment-reference-tab${trialPostView === 'all' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('all')}
            >
              {trialPostView === 'all' ? <h1 id="trial-post-heading">全部试岗记录</h1> : '全部试岗记录'}
            </button>
          </nav>
        </div>
        <Space className="trial-post-actions employment-reference-actions" size={8}>
          <Button type="primary" disabled>发起考核</Button>
        </Space>
      </header>

      <Alert
        className="trial-post-reference-notice employment-reference-notice"
        type="info"
        showIcon
        message={(
          <div>
            <div>1、可通过在员工调动及调动申请时，将“试岗方式”字段设为“新增试岗期/继续试岗/重新试岗”，来维护员工试岗期信息。</div>
            <div>2、调动生效后，试岗人员可在【试岗中人员】视图中查看，并可以发起试岗考核。</div>
            <div>3、若试岗人员未通过试岗考核需要调回原部门/原岗位时，可在【试岗不通过】视图中，点击员工姓名进入员工详情页，操作调动/调动申请将其调回。</div>
          </div>
        )}
      />

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

      <div className="employee-table-surface employment-reference-surface">
        <div className="employee-filter-toolbar trial-post-filter-toolbar employment-reference-filter-toolbar">
          <div className="trial-post-filter-controls employment-reference-filter-controls">
            <Input.Search
              className="trial-post-keyword-input employment-reference-person-filter"
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
              className="trial-post-end-date-filter employment-reference-date-filter"
              aria-label="筛选试岗结束日期"
              placeholder={['试岗结束日期开始', '试岗结束日期结束']}
              value={[
                query.endDateFrom ? dayjs(query.endDateFrom) : null,
                query.endDateTo ? dayjs(query.endDateTo) : null,
              ]}
              onChange={(_, dates) => patchSearch({
                endDateFrom: dates[0] || undefined,
                endDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
            <Select
              className="trial-post-department-filter employment-reference-unavailable-filter"
              aria-label="筛选试岗部门"
              placeholder="试岗部门"
              disabled
            />
            <Select
              className="trial-post-position-filter employment-reference-unavailable-filter"
              aria-label="筛选试岗职务"
              placeholder="试岗职务"
              disabled
            />
            <Select
              className="trial-post-expiring-filter employment-reference-unavailable-filter"
              aria-label="筛选试岗到期天数"
              placeholder="试岗到期天数"
              disabled
            />
            <Button
              className="trial-post-advanced-filter"
              type="link"
              onClick={openAdvancedFilters}
            >
              高级筛选 <DownOutlined />
            </Button>
          </div>
        </div>

        <Table<TrialPostListItem>
          className="employee-table trial-post-table employment-reference-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={trialPosts.isLoading}
          columns={trialPostColumns}
          dataSource={trialPosts.isError ? [] : (trialPosts.data?.data ?? [])}
          scroll={{ x: 1_450 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: trialPosts.isError
            ? null
            : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的试岗记录" /> }}
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

      {advancedOpen ? (
        <div className="trial-post-advanced-filter employment-reference-advanced-filter" role="dialog" aria-label="高级筛选">
          <div>筛选试岗开始日期</div>
          <DatePicker.RangePicker
            aria-label="筛选试岗开始日期"
            placeholder={['试岗开始日期开始', '试岗开始日期结束']}
            value={advancedDraft.startDateFrom && advancedDraft.startDateTo
              ? [dayjs(advancedDraft.startDateFrom), dayjs(advancedDraft.startDateTo)]
              : null}
            onChange={(_, dates) => setAdvancedDraft({
              startDateFrom: dates[0] || undefined,
              startDateTo: dates[1] || undefined,
            })}
          />
          <Button onClick={cancelAdvancedFilters}>取消</Button>
          <Button type="primary" onClick={applyAdvancedFilters}>确定</Button>
        </div>
      ) : null}
    </section>
  );
}
