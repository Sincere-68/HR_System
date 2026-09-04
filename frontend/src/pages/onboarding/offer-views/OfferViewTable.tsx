import type { OfferListItem, PaginatedOfferList } from '@hr-demo/shared';
import { Empty, Table } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';

export interface OfferViewTableProps {
  columns: ColumnsType<OfferListItem>;
  emptyText: string;
  onPageChange: (page: number, pageSize: number) => void;
  page: number;
  pageSize: number;
  query: UseQueryResult<PaginatedOfferList, Error>;
  scrollX: number;
  onSelectedRowIdsChange?: (ids: string[]) => void;
}

export function OfferViewTable({
  columns,
  emptyText,
  onPageChange,
  page,
  pageSize,
  query,
  scrollX,
  onSelectedRowIdsChange,
}: OfferViewTableProps) {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    onPageChange(pagination.current ?? 1, pagination.pageSize ?? pageSize);
  };

  return (
    <div className="onboarding-table-surface offer-view-table-surface">
      <Table<OfferListItem>
        className="employee-table onboarding-table offer-view-table"
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => {
            setSelectedRowKeys(keys);
            onSelectedRowIdsChange?.(keys.map(String));
          },
          columnWidth: 38,
        }}
        loading={query.isLoading}
        columns={columns}
        dataSource={query.data?.data ?? []}
        scroll={{ x: scrollX }}
        sticky={{ offsetHeader: 48, offsetScroll: 0 }}
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
  );
}
