import type { Paginated } from '@hr-demo/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { Alert, Button, Empty, Table, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { Link } from 'react-router-dom';

export function renderNullable(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

export function renderEmployeeDetailAction(
  employeeId: string | null | undefined,
  canViewEmployeeDetail: boolean,
) {
  if (!employeeId || !canViewEmployeeDetail) {
    return (
      <Button type="link" size="small" disabled>
        暂无详情
      </Button>
    );
  }

  return <Link to={`/personnel/employees/${employeeId}`}>查看</Link>;
}

export interface SubsetsListPageProps<T extends { id: string }> {
  title: string;
  columns: ColumnsType<T>;
  query: UseQueryResult<Paginated<T>, Error>;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  scrollX: number;
  emptyText: string;
}

export function SubsetsListPage<T extends { id: string }>({
  title,
  columns,
  query,
  page,
  pageSize,
  onPageChange,
  scrollX,
  emptyText,
}: SubsetsListPageProps<T>) {
  const handleTableChange = (pagination: TablePaginationConfig) => {
    onPageChange(pagination.current ?? 1, pagination.pageSize ?? pageSize);
  };

  return (
    <section className="subsets-list-page" aria-labelledby="subsets-list-heading">
      <header className="subsets-page-heading">
        <Typography.Title id="subsets-list-heading" level={1}>{title}</Typography.Title>
      </header>

      {query.isError ? (
        <Alert
          className="subsets-content-alert"
          type="error"
          showIcon
          message={`${title}加载失败`}
          description={query.error.message}
          action={<Button size="small" onClick={() => query.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="subsets-table-surface">
        <Table<T>
          className="subsets-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={query.isLoading}
          columns={columns}
          dataSource={query.data?.data ?? []}
          scroll={{ x: scrollX }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /> }}
          pagination={{
            current: page,
            pageSize,
            total: query.data?.meta.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
          }}
          onChange={handleTableChange}
        />
      </div>
    </section>
  );
}
