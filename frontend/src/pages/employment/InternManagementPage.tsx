import {
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  StopOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { InternListItem, InternListQuery } from '@hr-demo/shared';
import { Alert, Button, Empty, Input, Select, Table } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInterns } from '../../features/employment/api';

type InternManagementView = 'current' | 'converting' | 'regularized' | 'exited';

const internTabs: Array<{
  view: InternManagementView;
  label: string;
  reason?: string;
  backendView?: InternListQuery['view'];
}> = [
  { view: 'current', label: '实习生' },
  { view: 'converting', label: '实习转正中', reason: '转换事件来源待确认' },
  { view: 'regularized', label: '已转正', reason: '实习转换完成事件来源待确认' },
  { view: 'exited', label: '已离职', backendView: 'resigned' },
];

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

export const internColumns: ColumnsType<InternListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: displayValue },
  { title: '邮箱', dataIndex: 'workEmail', width: 180, render: displayValue },
  { title: '实习机构', dataIndex: 'internshipOrganizationName', width: 160, render: () => '--' },
  { title: '实习部门', dataIndex: 'departmentName', width: 160, render: displayValue },
  { title: '实习职位', dataIndex: 'positionName', width: 160, render: displayValue },
  { title: '实习开始日期', dataIndex: 'startDate', width: 140, render: displayValue },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: () => '--' },
  { title: '直线经理', dataIndex: 'managerName', width: 130, render: () => '--' },
  { title: '银行', dataIndex: 'bankName', width: 130, render: () => '--' },
  { title: '银行账号', dataIndex: 'bankAccountNumber', width: 160, render: () => '--' },
  { title: '开户行支行', dataIndex: 'bankBranchName', width: 160, render: () => '--' },
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

function CurrentInternsView({
  query,
  patchSearch,
  view,
}: {
  query: InternListQuery;
  patchSearch: (changes: Record<string, string | number | undefined>) => void;
  view: 'current' | 'exited';
}) {
  const interns = useInterns(query);
  const [keywordInput, setKeywordInput] = useState(query.keyword ?? '');

  useEffect(() => {
    setKeywordInput(query.keyword ?? '');
  }, [query.keyword]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    patchSearch({ page: pagination.current ?? 1, pageSize: pagination.pageSize ?? 10 });
  };

  return (
    <>
      {interns.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="实习生管理加载失败"
          description={interns.error.message}
          action={<Button size="small" onClick={() => interns.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar employment-reference-filter-toolbar intern-filter-toolbar">
          <div className="employment-reference-filter-controls intern-filter-controls">
            <Input.Search
              className="intern-keyword-input"
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
            <Input className="intern-email-input" aria-label="筛选邮箱" placeholder="邮箱" disabled />
            <Select
              className="intern-department-select"
              aria-label="筛选实习部门"
              placeholder="实习部门"
              disabled
            />
            <Select
              className="intern-position-select"
              aria-label="筛选实习职位"
              placeholder="实习职位"
              disabled
            />
          </div>
        </div>

        <Table<InternListItem>
          className="employee-table employment-reference-table intern-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={interns.isLoading}
          columns={internColumns}
          dataSource={interns.data?.data ?? []}
          scroll={{ x: 1_650 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={view === 'exited' ? '没有符合条件的已离职实习记录' : '没有符合条件的实习生任职记录'} /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: interns.data?.meta.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
          }}
          onChange={handleTableChange}
        />
      </div>
    </>
  );
}

export function InternManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const view: InternManagementView = requestedView === 'converting'
    || requestedView === 'regularized'
    || requestedView === 'exited'
    ? requestedView
    : 'current';
  const selectedTab = internTabs.find((tab) => tab.view === view) ?? internTabs[0]!;
  const query = useMemo<InternListQuery>(() => ({
    ...(selectedTab.backendView ? { view: selectedTab.backendView } : {}),
    keyword: searchParams.get('keyword') || undefined,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams, selectedTab]);

  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  return (
    <section className="employee-list-page employment-reference-page intern-management-page" aria-labelledby="intern-heading">
      <header className="employee-page-heading employment-reference-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <nav className="blacklist-heading-tabs employment-reference-tabs" aria-label="实习生管理视图">
            {internTabs.map((tab) => (
              <button
                className={`blacklist-heading-tab employment-reference-tab${view === tab.view ? ' is-active' : ''}`}
                key={tab.view}
                type="button"
                title={tab.reason}
                onClick={() => patchSearch({ view: tab.view === 'current' ? undefined : tab.view, page: 1 })}
              >
                {view === tab.view ? <h1 id="intern-heading">{tab.label}</h1> : tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="employment-reference-actions" aria-label="实习生管理操作">
          <Button type="primary" disabled>批量实习转正</Button>
          <Button icon={<PlusOutlined />} disabled>新增实习生</Button>
          <Button icon={<EditOutlined />} disabled>批量编辑</Button>
          <Button icon={<StopOutlined />} disabled>批量结束实习</Button>
          <Button icon={<DownOutlined />} disabled>更多操作</Button>
        </div>
      </header>

      <Alert
        className="employment-reference-notice"
        type="info"
        showIcon
        message={(
          <span>
            {view === 'exited'
              ? '已离职实习记录按退出日期的历史任职关系查询；转换事件来源尚未接入。'
              : '当前页面仅展示当前有效实习任职记录；转换事件来源尚未接入。'}
            <span className="employment-reference-notice-link">更多常见问题及解答</span>
          </span>
        )}
      />

      {view === 'current' || view === 'exited' ? (
        <CurrentInternsView query={query} patchSearch={patchSearch} view={view} />
      ) : (
        <div className="employment-reference-unsupported" role="status">
          <strong>该视图暂不可用</strong>
          <span>暂不可用：{selectedTab.reason}</span>
        </div>
      )}
    </section>
  );
}
