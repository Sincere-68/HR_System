import { EyeOutlined, UserSwitchOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { InternListItem, InternListQuery } from '@hr-demo/shared';
import { Alert, Button, Empty, Input, Table, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInterns } from '../../features/employment/api';

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
  { title: '实习机构', dataIndex: 'internshipOrganizationName', width: 160, render: displayValue },
  { title: '实习部门', dataIndex: 'departmentName', width: 160, render: displayValue },
  { title: '实习职位', dataIndex: 'positionName', width: 160, render: displayValue },
  { title: '实习开始日期', dataIndex: 'startDate', width: 140, render: displayValue },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: displayValue },
  { title: '直线经理', dataIndex: 'managerName', width: 130, render: displayValue },
  { title: '银行', dataIndex: 'bankName', width: 130, render: displayValue },
  { title: '银行账号', dataIndex: 'bankAccountNumber', width: 160, render: displayValue },
  { title: '开户行支行', dataIndex: 'bankBranchName', width: 160, render: displayValue },
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

export function InternManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<InternListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const interns = useInterns(query);
  const [keywordInput, setKeywordInput] = useState(query.keyword ?? '');
  useEffect(() => setKeywordInput(query.keyword ?? ''), [query.keyword]);

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
    <section className="employee-list-page intern-management-page" aria-labelledby="intern-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <h1 id="intern-heading">实习生管理</h1>
        </div>
      </header>
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
        <div className="employee-filter-toolbar intern-filter-toolbar">
          <Input.Search
            className="intern-keyword-input"
            allowClear
            value={keywordInput}
            aria-label="搜索实习生"
            placeholder="搜索姓名或工号"
            onChange={(event) => setKeywordInput(event.target.value)}
            onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
          />
          <Typography.Text type="secondary">共 {interns.data?.meta.total ?? 0} 条</Typography.Text>
        </div>
        <Table<InternListItem>
          className="employee-table intern-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={interns.isLoading}
          columns={internColumns}
          dataSource={interns.data?.data ?? []}
          scroll={{ x: 1_650 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的实习生任职记录" /> }}
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
    </section>
  );
}
