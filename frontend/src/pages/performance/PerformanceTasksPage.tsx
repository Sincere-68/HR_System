import { Empty, Segmented, Skeleton, Table, Tag, Alert, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { usePerformanceTasks } from '../../features/performance/api';
import type { PerformanceTaskListItem } from '@hr-demo/shared';

export function PerformanceTasksPage() {
  const [scope, setScope] = useState<'IN_PROGRESS' | 'COMPLETED'>('IN_PROGRESS');
  const tasks = usePerformanceTasks({ status: scope });
  const columns: TableColumnsType<PerformanceTaskListItem> = [
    { title: '绩效周期', dataIndex: 'cycleName', key: 'cycleName', width: 180 },
    { title: '考核人员', key: 'employee', width: 150, render: (_, row) => `${row.employeeName}（${row.employeeNo}）` },
    { title: '当前模块', dataIndex: 'moduleName', key: 'moduleName', width: 180 },
    { title: '执行人', dataIndex: 'executorName', key: 'executorName', width: 140, render: (value) => value ?? '--' },
    { title: '处理状态', key: 'status', width: 130, render: (_, row) => <Tag color={row.isCurrent ? 'processing' : 'default'}>{row.isCurrent ? '当前处理' : row.status === 'COMPLETED' ? '已完成' : '未开始'}</Tag> },
    { title: '最终得分', key: 'score', width: 130, render: () => '--' },
  ];
  return (
    <section className="performance-list-page" aria-labelledby="performance-tasks-title">
      <header className="performance-page-heading"><div><span>流程执行</span><h1 id="performance-tasks-title">绩效任务</h1></div><Segmented options={[{ label: '进行中', value: 'IN_PROGRESS' }, { label: '已完成', value: 'COMPLETED' }]} value={scope} onChange={(value) => setScope(value as typeof scope)} /></header>
      {tasks.isError ? <Alert type="error" showIcon message="无法加载绩效任务" description={tasks.error.message} /> : null}
      <div className="performance-table-surface">{tasks.isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : <Table<PerformanceTaskListItem> className="performance-table" rowKey="id" columns={columns} dataSource={tasks.data?.data ?? []} pagination={false} locale={{ emptyText: <Empty description={`暂无${scope === 'IN_PROGRESS' ? '进行中' : '已完成'}绩效任务`} /> }} />}</div>
    </section>
  );
}
