import { ExportOutlined, SolutionOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Table, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { Paginated } from '@hr-demo/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { TableExportDialog, type TableExportField } from '../../features/employees/TableExportDialog';
import { Link } from 'react-router-dom';

export function renderNullable(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

export function renderUnavailableAction() {
  return (
    <Button type="link" size="small" disabled>
      暂无操作
    </Button>
  );
}

export interface OnboardingListPageProps<T extends { id: string }> {
  title: string;
  columns: ColumnsType<T>;
  query: UseQueryResult<Paginated<T>, Error>;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  scrollX: number;
  emptyText: string;
  headingTabs?: Array<{ label: string; to: string; active: boolean }>;
  exportConfig?: {
    fields: TableExportField[];
    onExport: (input: { format: 'XLSX' | 'CSV'; fields: string[]; employeeIds?: string[] }) => Promise<void>;
  };
}

export function OnboardingListPage<T extends { id: string }>({
  title,
  columns,
  query,
  page,
  pageSize,
  onPageChange,
  scrollX,
  emptyText,
  headingTabs,
  exportConfig,
}: OnboardingListPageProps<T>) {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const exportFields = useMemo(() => exportConfig?.fields ?? [], [exportConfig]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    onPageChange(pagination.current ?? 1, pagination.pageSize ?? pageSize);
  };

  return (
    <section className="onboarding-list-page" aria-labelledby="onboarding-list-heading">
      {headingTabs ? (
        <header className="employee-page-heading onboarding-page-heading">
          <div className="employee-title-group blacklist-title-group">
            <span className="employee-title-icon" aria-hidden="true"><SolutionOutlined /></span>
            <nav className="blacklist-heading-tabs" aria-label="入职管理功能">
              {headingTabs.map((tab, index) => (
                <Link
                  className={`blacklist-heading-tab${tab.active ? ' is-active' : ''}`}
                  key={tab.to}
                  to={tab.to}
                >
                  {index === 0 ? <h1 id="onboarding-list-heading">{tab.label}</h1> : tab.label}
                </Link>
              ))}
              {exportConfig ? <Button icon={<ExportOutlined />} onClick={() => setExportOpen(true)}>导出</Button> : null}
            </nav>
          </div>
        </header>
      ) : (
        <header className="onboarding-page-heading">
          <Typography.Title id="onboarding-list-heading" level={1}>{title}</Typography.Title>
          {exportConfig ? <Button icon={<ExportOutlined />} onClick={() => setExportOpen(true)}>导出</Button> : null}
        </header>
      )}
      {exportConfig ? (
        <TableExportDialog
          open={exportOpen}
          title={`导出${title}`}
          fields={exportFields}
          selectedRowIds={selectedRowKeys.map(String)}
          onClose={() => setExportOpen(false)}
          onExport={exportConfig.onExport}
        />
      ) : null}
      {query.isError ? (
        <Alert
          className="onboarding-content-alert"
          type="error"
          showIcon
          message={`${title}加载失败`}
          description={query.error.message}
          action={<Button size="small" onClick={() => query.refetch()}>重试</Button>}
        />
      ) : null}
      <div className="onboarding-table-surface">
        <Table<T>
          className="employee-table onboarding-table"
          rowKey="id"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys, columnWidth: 38 }}
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
            pageSizeOptions: [10, 20, 50],
            showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
          }}
          onChange={handleTableChange}
        />
      </div>
    </section>
  );
}
