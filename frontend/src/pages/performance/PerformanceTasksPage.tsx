import { Empty, Segmented, Skeleton, Space, Table, Tag, Alert, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { usePerformanceTasks, usePerformanceWorkflowTasks } from '../../features/performance/api';
import type { PerformanceTaskListItem, PerformanceWorkflowTaskListItem } from '@hr-demo/shared';

const workflowTypeLabels: Record<PerformanceWorkflowTaskListItem['stepType'], string> = {
  REVIEW: '审核',
  CONFIRMATION: '本人确认',
  APPROVAL: '审批',
  HR_ARCHIVE: 'HR 归档',
};

export function PerformanceTasksPage() {
  const [scope, setScope] = useState<'IN_PROGRESS' | 'COMPLETED'>('IN_PROGRESS');
  const [kind, setKind] = useState<'assessment' | 'workflow'>('assessment');
  const assessmentTasks = usePerformanceTasks({ status: scope });
  const workflowTasks = usePerformanceWorkflowTasks({ status: scope });
  const assessmentColumns: TableColumnsType<PerformanceTaskListItem> = [
    { title: '绩效周期', dataIndex: 'cycleName', key: 'cycleName', width: 180 },
    { title: '考核人员', key: 'employee', width: 150, render: (_, row) => `${row.employeeName}（${row.employeeNo}）` },
    { title: '考核表模块', dataIndex: 'moduleName', key: 'moduleName', width: 180 },
    { title: '执行人', dataIndex: 'executorName', key: 'executorName', width: 140, render: (value) => value ?? '--' },
    { title: '处理状态', key: 'status', width: 130, render: (_, row) => <Tag color={row.isCurrent ? 'processing' : row.status === 'COMPLETED' ? 'success' : 'default'}>{row.isCurrent ? '当前处理' : row.status === 'COMPLETED' ? '已完成' : '未开始'}</Tag> },
    { title: '最终得分', key: 'score', width: 130, render: () => '--' },
  ];
  const workflowColumns: TableColumnsType<PerformanceWorkflowTaskListItem> = [
    { title: '绩效周期', dataIndex: 'cycleName', key: 'cycleName', width: 180 },
    { title: '考核人员', key: 'employee', width: 150, render: (_, row) => `${row.employeeName}（${row.employeeNo}）` },
    { title: '后续流程步骤', key: 'step', width: 210, render: (_, row) => <Space size={6}>{row.stepName}<Tag>{workflowTypeLabels[row.stepType]}</Tag></Space> },
    { title: '执行人', dataIndex: 'executorName', key: 'executorName', width: 150, render: (value) => value ?? '--' },
    { title: '处理状态', key: 'status', width: 130, render: (_, row) => <Tag color={row.isCurrent ? 'processing' : row.status === 'COMPLETED' ? 'success' : 'default'}>{row.isCurrent ? '当前处理' : row.status === 'COMPLETED' ? '已完成' : '未开始'}</Tag> },
  ];
  const active = kind === 'assessment' ? assessmentTasks : workflowTasks;
  return (
    <section className="performance-list-page" aria-labelledby="performance-tasks-title">
      <header className="performance-page-heading"><div><span>流程执行</span><h1 id="performance-tasks-title">绩效任务</h1></div><Space><Segmented options={[{ label: '考核表', value: 'assessment' }, { label: '后续流程', value: 'workflow' }]} value={kind} onChange={(value) => setKind(value as typeof kind)} /><Segmented options={[{ label: '进行中', value: 'IN_PROGRESS' }, { label: '已完成', value: 'COMPLETED' }]} value={scope} onChange={(value) => setScope(value as typeof scope)} /></Space></header>
      {active.isError ? <Alert type="error" showIcon message="无法加载绩效任务" description={active.error.message} /> : null}
      <div className="performance-table-surface">{active.isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : kind === 'assessment' ? <Table<PerformanceTaskListItem> className="performance-table" rowKey="id" columns={assessmentColumns} dataSource={assessmentTasks.data?.data ?? []} pagination={false} locale={{ emptyText: <Empty description={`暂无${scope === 'IN_PROGRESS' ? '进行中' : '已完成'}考核表任务`} /> }} /> : <Table<PerformanceWorkflowTaskListItem> className="performance-table" rowKey="id" columns={workflowColumns} dataSource={workflowTasks.data?.data ?? []} pagination={false} locale={{ emptyText: <Empty description={`暂无${scope === 'IN_PROGRESS' ? '进行中' : '已完成'}后续流程任务`} /> }} />}</div>
    </section>
  );
}
