import { EyeOutlined, UserSwitchOutlined } from '@ant-design/icons';
import type { LaborWorkerListItem, LaborWorkerListQuery } from '@hr-demo/shared';
import { Alert, Button, DatePicker, Empty, Input, Table, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { workArrangementLabels } from '../../config/personnel-fields';
import { useLaborWorkers } from '../../features/employment/api';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

export const laborWorkerColumns: ColumnsType<LaborWorkerListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: displayValue },
  { title: '电子邮箱', dataIndex: 'workEmail', width: 180, render: displayValue },
  { title: '工号', dataIndex: 'employeeNo', width: 130, render: displayValue },
  { title: '入职日期', dataIndex: 'entryDate', width: 130, render: displayValue },
  { title: '部门', dataIndex: 'departmentName', width: 170, render: displayValue },
  { title: '职务', dataIndex: 'jobTitleName', width: 150, render: displayValue },
  {
    title: '用工形式',
    dataIndex: 'workArrangement',
    width: 130,
    render: (value) => displayValue(value ? workArrangementLabels[value as keyof typeof workArrangementLabels] ?? value : null),
  },
  { title: '直线经理', dataIndex: 'managerName', width: 130, render: displayValue },
  { title: '工作地点', dataIndex: 'workplaceName', width: 150, render: displayValue },
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

export function LaborWorkerManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<LaborWorkerListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    entryDateFrom: searchParams.get('entryDateFrom') || undefined,
    entryDateTo: searchParams.get('entryDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const laborWorkers = useLaborWorkers(query);
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
    <section className="employee-list-page labor-worker-management-page" aria-labelledby="labor-worker-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <h1 id="labor-worker-heading">劳务人员管理</h1>
        </div>
      </header>

      {laborWorkers.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="劳务人员管理加载失败"
          description={laborWorkers.error.message}
          action={<Button size="small" onClick={() => laborWorkers.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar labor-worker-filter-toolbar">
          <div className="labor-worker-filter-controls">
            <Input.Search
              className="labor-worker-keyword-input"
              allowClear
              value={keywordInput}
              aria-label="搜索劳务人员"
              placeholder="搜索姓名或工号"
              onChange={(event) => setKeywordInput(event.target.value)}
              onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
            />
            <DatePicker.RangePicker
              aria-label="筛选入职日期"
              value={query.entryDateFrom && query.entryDateTo
                ? [dayjs(query.entryDateFrom), dayjs(query.entryDateTo)]
                : null}
              onChange={(_, dates) => patchSearch({
                entryDateFrom: dates[0] || undefined,
                entryDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
          </div>
          <Typography.Text type="secondary">共 {laborWorkers.data?.meta.total ?? 0} 条</Typography.Text>
        </div>

        <Table<LaborWorkerListItem>
          className="employee-table labor-worker-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={laborWorkers.isLoading}
          columns={laborWorkerColumns}
          dataSource={laborWorkers.data?.data ?? []}
          scroll={{ x: 1_450 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的当前劳务人员任职记录" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: laborWorkers.data?.meta.total ?? 0,
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
