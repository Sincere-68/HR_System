import { EyeOutlined, StopOutlined } from '@ant-design/icons';
import type { BlacklistListItem, BlacklistListQuery } from '@hr-demo/shared';
import { Alert, Button, Empty, Input, Table, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBlacklist } from '../../features/employees/api';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

const columns: ColumnsType<BlacklistListItem> = [
  { title: '姓名', dataIndex: 'name', width: 140, render: displayValue },
  { title: '证件号码', dataIndex: 'documentNumber', width: 210, render: displayValue },
  { title: '手机号', dataIndex: 'mobile', width: 150, render: displayValue },
  { title: '加黑原因', dataIndex: 'reason', width: 280, render: displayValue },
  { title: '加黑日期', dataIndex: 'effectiveDate', width: 130, render: displayValue },
  { title: '有效截止日期', dataIndex: 'expiryDate', width: 140, render: displayValue },
  { title: '邮箱', dataIndex: 'workEmail', width: 220, render: displayValue },
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
      <Button type="link" size="small" disabled title="该黑名单记录未关联员工主档案">
        暂无详情
      </Button>
    ),
  },
];

export function BlacklistPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<BlacklistListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const blacklist = useBlacklist(query);

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
    <section className="employee-list-page blacklist-list-page" aria-labelledby="blacklist-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><StopOutlined /></span>
          <nav className="blacklist-heading-tabs" aria-label="黑名单功能">
            <Link className="blacklist-heading-tab is-active" to="/personnel/blacklist">
              <h1 id="blacklist-heading">黑名单</h1>
            </Link>
            <Link className="blacklist-heading-tab" to="/personnel/blacklist-removals">
              黑名单移出记录
            </Link>
          </nav>
        </div>
      </header>

      {blacklist.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="黑名单加载失败"
          description={blacklist.error.message}
          action={<Button size="small" onClick={() => blacklist.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar blacklist-filter-toolbar">
          <Input.Search
            className="blacklist-keyword-input"
            allowClear
            defaultValue={query.keyword}
            aria-label="搜索黑名单"
            placeholder="搜索姓名、证件号码或手机号"
            onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
          />
          <Typography.Text type="secondary">
            邮箱为关联员工的公司邮箱，无关联员工或未录入时显示 --；共 {blacklist.data?.meta.total ?? 0} 条
          </Typography.Text>
        </div>

        <Table<BlacklistListItem>
          className="employee-table blacklist-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={blacklist.isLoading}
          columns={columns}
          dataSource={blacklist.data?.data ?? []}
          scroll={{ x: 1_370 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的黑名单记录" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: blacklist.data?.meta.total ?? 0,
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
