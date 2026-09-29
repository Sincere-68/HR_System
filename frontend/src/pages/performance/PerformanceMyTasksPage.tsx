import { Empty, Alert, Button, Segmented, Skeleton, Space, Table, Tag, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { usePerformanceTasks, usePerformanceWorkflowTasks, useSubmitPerformanceWorkflowTask } from '../../features/performance/api';
import type { PerformanceTaskListItem, PerformanceWorkflowTaskListItem } from '@hr-demo/shared';

const workflowTypeLabels: Record<PerformanceWorkflowTaskListItem['stepType'], string> = {
  REVIEW: '审核',
  CONFIRMATION: '本人确认',
  APPROVAL: '审批',
  HR_ARCHIVE: 'HR 归档',
};

export function PerformanceMyTasksPage() {
  const [scope, setScope] = useState<'assessment' | 'workflow'>('assessment');
  const assessmentTasks = usePerformanceTasks({ status: 'IN_PROGRESS' }, true);
  const workflowTasks = usePerformanceWorkflowTasks({ status: 'IN_PROGRESS' }, true);
  const submitWorkflow = useSubmitPerformanceWorkflowTask();
  const assessmentColumns: TableColumnsType<PerformanceTaskListItem> = [
    { title: '绩效周期', dataIndex: 'cycleName', key: 'cycleName', width: 190 },
    { title: '考核人员', key: 'employee', width: 150, render: (_, row) => `${row.employeeName}（${row.employeeNo}）` },
    { title: '考核表模块', dataIndex: 'moduleName', key: 'moduleName', width: 190 },
    { title: '执行人', dataIndex: 'executorName', key: 'executorName', width: 140 },
    { title: '状态', key: 'status', width: 120, render: () => <Tag color="processing">待处理</Tag> },
    { title: '操作', key: 'actions', width: 110, render: (_, row) => row.canSubmit ? <Tag color="blue">可处理</Tag> : <Tag>只读</Tag> },
  ];
  const workflowColumns: TableColumnsType<PerformanceWorkflowTaskListItem> = [
    { title: '绩效周期', dataIndex: 'cycleName', key: 'cycleName', width: 190 },
    { title: '考核人员', key: 'employee', width: 150, render: (_, row) => `${row.employeeName}（${row.employeeNo}）` },
    { title: '后续流程步骤', key: 'step', width: 210, render: (_, row) => <Space size={6}>{row.stepName}<Tag>{workflowTypeLabels[row.stepType]}</Tag></Space> },
    { title: '执行人', dataIndex: 'executorName', key: 'executorName', width: 150, render: (value) => value ?? '--' },
    { title: '最终得分', dataIndex: 'finalScore', key: 'finalScore', width: 120, render: (value: number | null | undefined) => value === null || value === undefined ? '--' : value.toFixed(4) },
    { title: '实际金额', dataIndex: 'actualAmount', key: 'actualAmount', width: 130, render: (value: number | null | undefined) => value === null || value === undefined ? '--' : value.toFixed(2) },
    { title: '状态', key: 'status', width: 120, render: () => <Tag color="processing">待处理</Tag> },
    {
      title: '操作', key: 'actions', width: 180,
      render: (_, row) => {
        if (!row.canSubmit) return <Tag>只读</Tag>;
        const action = row.stepType === 'CONFIRMATION' ? 'CONFIRM' : row.stepType === 'HR_ARCHIVE' ? 'ARCHIVE' : 'APPROVE';
        const label = row.stepType === 'CONFIRMATION' ? '确认结果' : row.stepType === 'HR_ARCHIVE' ? '完成归档' : '通过';
        return <Button type="link" loading={submitWorkflow.isPending && submitWorkflow.variables?.id === row.id} onClick={() => submitWorkflow.mutate({ id: row.id, input: { action } })}>{label}</Button>;
      },
    },
  ];
  const active = scope === 'assessment' ? assessmentTasks : workflowTasks;
  return (
    <section className="performance-list-page" aria-labelledby="performance-my-tasks-title">
      <header className="performance-page-heading"><div><span>当前处理</span><h1 id="performance-my-tasks-title">我的待办</h1></div><Segmented options={[{ label: '考核表待办', value: 'assessment' }, { label: '后续流程待办', value: 'workflow' }]} value={scope} onChange={(value) => setScope(value as typeof scope)} /></header>
      {active.isError ? <Alert type="error" showIcon message="无法加载待处理绩效事项" description={active.error.message} /> : null}
      <div className="performance-table-surface">{active.isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : scope === 'assessment' ? <Table<PerformanceTaskListItem> className="performance-table" rowKey="id" columns={assessmentColumns} dataSource={assessmentTasks.data?.data ?? []} pagination={false} locale={{ emptyText: <Empty description="暂无待处理的考核表事项" /> }} /> : <Table<PerformanceWorkflowTaskListItem> className="performance-table" rowKey="id" columns={workflowColumns} dataSource={workflowTasks.data?.data ?? []} pagination={false} locale={{ emptyText: <Empty description="暂无待处理的后续流程事项" /> }} />}</div>
    </section>
  );
}
