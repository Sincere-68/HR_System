import { EyeOutlined, UserSwitchOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { ProbationListItem, ProbationListQuery, ProbationListView } from '@hr-demo/shared';
import { Alert, Button, Empty, Input, Table, Typography } from 'antd';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProbation } from '../../features/employment/api';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

const columns: ColumnsType<ProbationListItem> = [
  { title: '工号', dataIndex: 'employeeNo', width: 130, render: displayValue },
  { title: '姓名', dataIndex: 'employeeName', width: 130, render: displayValue },
  { title: '部门', dataIndex: 'departmentName', width: 180, render: displayValue },
  { title: '职位', dataIndex: 'positionName', width: 180, render: displayValue },
  { title: '试用开始日期', dataIndex: 'startDate', width: 150, render: displayValue },
  { title: '预计试用结束日期', dataIndex: 'plannedEndDate', width: 180, render: displayValue },
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

export function ProbationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const probationView: ProbationListView = rawView === 'reviewing' || rawView === 'approval' || rawView === 'all' || rawView === 'completed'
    ? rawView
    : 'expiring';
  const query = useMemo<ProbationListQuery>(() => ({
    view: probationView,
    keyword: searchParams.get('keyword') || undefined,
    status: (searchParams.get('status') as ProbationListQuery['status']) || undefined,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    plannedEndDateFrom: searchParams.get('plannedEndDateFrom') || undefined,
    plannedEndDateTo: searchParams.get('plannedEndDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [probationView, searchParams]);
  const probation = useProbation(query);

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
    <section className="employee-list-page employment-probation-page" aria-labelledby="probation-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <nav className="blacklist-heading-tabs" aria-label="试用管理功能">
            <button
              className={`blacklist-heading-tab${probationView === 'expiring' ? ' is-active' : ''}`}
              type="button"
              onClick={() => patchSearch({ view: 'expiring', status: undefined, page: 1 })}
            >
              <h1 id="probation-heading">即将试用到期</h1>
            </button>
            <button
              className={`blacklist-heading-tab${probationView === 'reviewing' ? ' is-active' : ''}`}
              type="button"
              onClick={() => patchSearch({ view: 'reviewing', status: undefined, page: 1 })}
            >
              考核中
            </button>
            <button
              className={`blacklist-heading-tab${probationView === 'approval' ? ' is-active' : ''}`}
              type="button"
              onClick={() => patchSearch({ view: 'approval', status: undefined, page: 1 })}
            >
              转正审批中
            </button>
            <button
              className={`blacklist-heading-tab${probationView === 'all' ? ' is-active' : ''}`}
              type="button"
              onClick={() => patchSearch({ view: 'all', status: undefined, page: 1 })}
            >
              全部试用员工
            </button>
            <button
              className={`blacklist-heading-tab${probationView === 'completed' ? ' is-active' : ''}`}
              type="button"
              onClick={() => patchSearch({ view: 'completed', status: undefined, page: 1 })}
            >
              已转正
            </button>
          </nav>
        </div>
      </header>
      {probation.isError ? (
        <Alert className="content-alert" type="error" showIcon message="试用管理加载失败" description={probation.error.message} action={<Button size="small" onClick={() => probation.refetch()}>重试</Button>} />
      ) : null}
      <div className="employee-table-surface">
        <div className="employee-filter-toolbar probation-filter-toolbar">
          <Input.Search
            className="probation-keyword-input"
            allowClear
            key={query.keyword ?? ''}
            defaultValue={query.keyword}
            aria-label="搜索试用记录"
            placeholder="搜索姓名或工号"
            onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
          />
          <Typography.Text type="secondary">共 {probation.data?.meta.total ?? 0} 条</Typography.Text>
        </div>
        <Table<ProbationListItem>
          className="employee-table probation-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={probation.isLoading}
          columns={columns}
          dataSource={probation.data?.data ?? []}
          scroll={{ x: 1_100 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的试用记录" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: probation.data?.meta.total ?? 0,
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
