import { IdcardOutlined } from '@ant-design/icons';
import type { AssignmentStatus, TransferTypeListItem, TransferTypeListQuery } from '@hr-demo/shared';
import { Alert, Button, Empty, Table, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTransferTypes } from '../../features/staffing/api';

const statusLabels: Record<string, string> = {
  ACTIVE: '有效',
  INACTIVE: '停用',
  ARCHIVED: '已归档',
  CANCELLED: '已取消',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  ARCHIVED: 'warning',
  CANCELLED: 'error',
};

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

export const transferTypeColumns: ColumnsType<TransferTypeListItem> = [
  { title: '调动类型', dataIndex: 'name', width: 220, render: displayValue },
  { title: '显示顺序', dataIndex: 'displayOrder', width: 140, render: displayValue },
  { title: '生效日期', dataIndex: 'effectiveDate', width: 160, render: displayValue },
  {
    title: '状态',
    dataIndex: 'status',
    width: 130,
    render: (status: AssignmentStatus) => (
      <Tag color={statusColors[status]}>{statusLabels[status] ?? status}</Tag>
    ),
  },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 110,
    render: () => <Button type="link" size="small" disabled>暂无操作</Button>,
  },
];

export function TransferTypesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<TransferTypeListQuery>(() => ({
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const transferTypes = useTransferTypes(query);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(pagination.current ?? 1));
    next.set('pageSize', String(pagination.pageSize ?? 10));
    setSearchParams(next, { replace: true });
  };

  return (
    <section className="employee-list-page transfer-types-page" aria-labelledby="transfer-types-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><IdcardOutlined /></span>
          <h1 id="transfer-types-heading">调动类型</h1>
        </div>
      </header>

      <Alert
        className="content-alert transfer-types-data-note"
        type="info"
        showIcon
        message="调动类型和状态来自 MovementType。当前模型没有显示顺序、生效日期及维护操作来源，因此统一显示 -- 或禁用操作，不使用编码或创建时间冒充。免数据库演示模式返回空页。"
      />

      {transferTypes.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="调动类型加载失败"
          description={transferTypes.error.message}
          action={<Button size="small" onClick={() => transferTypes.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <Typography.Text type="secondary">共 {transferTypes.data?.meta.total ?? 0} 条</Typography.Text>
        <Table<TransferTypeListItem>
          className="employee-table transfer-types-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={transferTypes.isLoading}
          columns={transferTypeColumns}
          dataSource={transferTypes.data?.data ?? []}
          scroll={{ x: 760 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的调动类型" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: transferTypes.data?.meta.total ?? 0,
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
