import { FileDoneOutlined } from '@ant-design/icons';
import type { ContractListItem, ContractListQuery } from '@hr-demo/shared';
import { Alert, Button, Empty, Table } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { renderAgreementType } from '../../config/agreement-types';
import { useContracts } from '../../features/contracts/api';

const termTypeLabels: Record<ContractListItem['termType'], string> = {
  FIXED: '固定期限',
  OPEN_ENDED: '无固定期限',
};

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

export const contractColumns: ColumnsType<ContractListItem> = [
  { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left' },
  { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left' },
  { title: '部门', dataIndex: 'departmentName', width: 150, render: displayValue },
  { title: '入职日期', dataIndex: 'entryDate', width: 120, render: displayValue },
  { title: '全日制公司', dataIndex: 'fullTimeCompany', width: 160, render: displayValue },
  {
    title: '合同类型', dataIndex: 'agreementType', width: 160,
    render: renderAgreementType,
  },
  {
    title: '期限类型', dataIndex: 'termType', width: 130,
    render: (value: ContractListItem['termType']) => termTypeLabels[value],
  },
  { title: '生效日期', dataIndex: 'effectiveDate', width: 120, render: displayValue },
  { title: '终止日期', dataIndex: 'endDate', width: 120, render: displayValue },
  {
    title: '最新电子协议签署状态', dataIndex: 'latestElectronicSignatureStatus', width: 180,
    render: displayValue,
  },
  {
    title: '最新电子协议附件', dataIndex: 'latestElectronicAgreementAttachment', width: 170,
    render: displayValue,
  },
  {
    title: '电子协议签署记录', dataIndex: 'electronicSignatureRecords', width: 170,
    render: displayValue,
  },
  { title: '合同备注', dataIndex: 'contractRemark', width: 180, render: displayValue },
  {
    title: '操作', key: 'actions', fixed: 'right', width: 110,
    render: () => <Button type="link" size="small" disabled>暂无操作</Button>,
  },
];

export function ContractsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<ContractListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const contracts = useContracts(query);

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
    <section className="employee-list-page contracts-page" aria-labelledby="contracts-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><FileDoneOutlined /></span>
          <h1 id="contracts-heading">合同协议</h1>
        </div>
      </header>

      {contracts.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="合同协议加载失败"
          description={contracts.error.message}
          action={<Button size="small" onClick={() => contracts.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <Table<ContractListItem>
          className="employee-table contracts-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={contracts.isLoading}
          columns={contractColumns}
          dataSource={contracts.data?.data ?? []}
          scroll={{ x: 2_150 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的合同协议" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: contracts.data?.meta.total ?? 0,
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
