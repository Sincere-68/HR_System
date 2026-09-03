import { Empty, Alert, Skeleton, Table, Tag, type TableColumnsType } from 'antd';
import { usePerformanceTasks } from '../../features/performance/api';
import type { PerformanceTaskListItem } from '@hr-demo/shared';

export function PerformanceMyTasksPage() {
  const tasks = usePerformanceTasks({ status: 'IN_PROGRESS' }, true);
  const columns: TableColumnsType<PerformanceTaskListItem> = [
    { title: '绩效周期', dataIndex: 'cycleName', key: 'cycleName', width: 190 },
    { title: '考核人员', key: 'employee', width: 150, render: (_, row) => `${row.employeeName}（${row.employeeNo}）` },
    { title: '当前模块', dataIndex: 'moduleName', key: 'moduleName', width: 190 },
    { title: '执行人', dataIndex: 'executorName', key: 'executorName', width: 140 },
    { title: '状态', key: 'status', width: 120, render: () => <Tag color="processing">待处理</Tag> },
    { title: '操作', key: 'actions', width: 110, render: (_, row) => row.canSubmit ? <Tag color="blue">可处理</Tag> : <Tag>只读</Tag> },
  ];
  return (
    <section className="performance-list-page" aria-labelledby="performance-my-tasks-title">
      <header className="performance-page-heading"><div><span>当前处理</span><h1 id="performance-my-tasks-title">我的待办</h1></div></header>
      {tasks.isError ? <Alert type="error" showIcon message="无法加载待处理绩效事项" description={tasks.error.message} /> : null}
      <div className="performance-table-surface">{tasks.isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : <Table<PerformanceTaskListItem> className="performance-table" rowKey="id" columns={columns} dataSource={tasks.data?.data ?? []} pagination={false} locale={{ emptyText: <Empty description="暂无待处理的绩效事项" /> }} />}</div>
    </section>
  );
}
