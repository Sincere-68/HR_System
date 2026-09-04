import { Empty, Alert, Skeleton, Table, Tag, type TableColumnsType } from 'antd';
import { usePerformanceResults } from '../../features/performance/api';
import type { PerformanceResultListItem } from '@hr-demo/shared';

export function PerformanceResultsPage() {
  const results = usePerformanceResults({ status: 'COMPLETED' });
  const columns: TableColumnsType<PerformanceResultListItem> = [
    { title: '绩效周期', dataIndex: 'cycleName', key: 'cycleName', width: 180 },
    { title: '考核人员', key: 'employee', width: 150, render: (_, row) => `${row.employeeName}（${row.employeeNo}）` },
    { title: '最终得分', key: 'score', width: 130, render: (_, row) => row.finalScore === null ? '--' : row.finalScore.toFixed(2) },
    { title: '个人金额基数快照', key: 'employeeAmountBase', width: 170, render: (_, row) => row.employeeAmountBaseSnapshot === null ? '--' : `¥${row.employeeAmountBaseSnapshot.toLocaleString('zh-CN')}` },
    { title: '基数版本', dataIndex: 'employeeAmountBaseVersionNo', key: 'employeeAmountBaseVersionNo', width: 100, render: (value) => value ?? '--' },
    { title: '实际审批金额', key: 'actualAmount', width: 170, render: (_, row) => row.actualAmount === null ? '--' : `¥${row.actualAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` },
    { title: '修订次数', dataIndex: 'revisionCount', key: 'revisionCount', width: 100 },
    { title: '审批状态', key: 'status', width: 130, render: () => <Tag color="default">待审批</Tag> },
  ];
  return (
    <section className="performance-list-page" aria-labelledby="performance-results-title">
      <header className="performance-page-heading"><div><span>结果管理</span><h1 id="performance-results-title">结果审批</h1></div></header>
      {results.isError ? <Alert type="error" showIcon message="无法加载绩效结果" description={results.error.message} /> : null}
      <div className="performance-table-surface">{results.isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : <Table<PerformanceResultListItem> className="performance-table" rowKey="id" columns={columns} dataSource={results.data?.data ?? []} pagination={false} locale={{ emptyText: <Empty description="暂无已生成个人绩效金额的结果" /> }} />}</div>
    </section>
  );
}
