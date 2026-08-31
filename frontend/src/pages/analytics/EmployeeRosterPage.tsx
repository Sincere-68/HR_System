import { BarChartOutlined } from '@ant-design/icons';
import type { EmployeeRosterListQuery } from '@hr-demo/shared';
import { Alert, Button, Empty, Input, Table } from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEmployeeRosterList } from '../../features/analytics/api';
import { employeeRosterColumns } from './employee-roster-columns';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function EmployeeRosterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<EmployeeRosterListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const roster = useEmployeeRosterList(query);

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
    <section className="employee-list-page employee-roster-page" aria-labelledby="employee-roster-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><BarChartOutlined /></span>
          <h1 id="employee-roster-heading">员工名册</h1>
        </div>
      </header>

      {roster.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="员工名册加载失败"
          description={roster.error instanceof Error ? roster.error.message : '请稍后重试'}
          action={<Button size="small" onClick={() => roster.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar employee-roster-filter-toolbar">
          <Input.Search
            className="employee-roster-keyword-input"
            allowClear
            value={query.keyword ?? ''}
            aria-label="搜索员工名册"
            placeholder="搜索姓名或工号"
            onChange={(event) => {
              if (!event.target.value) patchSearch({ keyword: undefined, page: 1 });
            }}
            onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
          />
        </div>

        <Table
          className="employee-table employee-roster-table"
          rowKey="id"
          loading={roster.isLoading}
          columns={employeeRosterColumns}
          dataSource={roster.data?.data ?? []}
          scroll={{ x: 6_400 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无当前在职员工" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: roster.data?.meta.total ?? 0,
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
