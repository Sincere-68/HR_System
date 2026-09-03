import { ArrowRightOutlined, AuditOutlined, CheckSquareOutlined, FileTextOutlined } from '@ant-design/icons';
import { Empty, Skeleton, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import { usePerformanceCycles, usePerformanceDashboard } from '../../features/performance/api';

const overviewRoutes = [
  { label: '绩效模板', key: 'templateCount', route: '/performance/templates', icon: <FileTextOutlined />, tone: 'teal' },
  { label: '进行中任务', key: 'activeTaskCount', route: '/performance/tasks', icon: <CheckSquareOutlined />, tone: 'blue' },
  { label: '待审批结果', key: 'pendingResultCount', route: '/performance/results', icon: <AuditOutlined />, tone: 'green' },
] as const;

export function PerformanceDashboardPage() {
  const navigate = useNavigate();
  const dashboard = usePerformanceDashboard();
  const cycles = usePerformanceCycles({ status: 'IN_PROGRESS' });
  const overview = dashboard.data ?? { templateCount: 0, activeTaskCount: 0, pendingResultCount: 0 };

  return (
    <section className="performance-dashboard-page" aria-labelledby="performance-dashboard-title">
      <header className="performance-page-heading">
        <div>
          <span>绩效系统</span>
          <h1 id="performance-dashboard-title">绩效总览</h1>
        </div>
      </header>

      {dashboard.isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : null}
      {dashboard.isError ? <Alert type="error" showIcon message="无法加载绩效总览" description={dashboard.error.message} /> : null}
      <div className="performance-overview-grid" aria-label="绩效概览">
        {overviewRoutes.map((item) => (
          <button
            className={`performance-overview-item is-${item.tone}`}
            key={item.label}
            type="button"
            onClick={() => navigate(item.route)}
          >
            <span className="performance-overview-icon" aria-hidden="true">{item.icon}</span>
            <span className="performance-overview-label">{item.label}</span>
            <strong>{overview[item.key]}</strong>
            <ArrowRightOutlined className="performance-overview-arrow" aria-hidden="true" />
          </button>
        ))}
      </div>

      <section className="performance-workbench" aria-labelledby="current-cycle-title">
        <header className="performance-section-heading">
          <h2 id="current-cycle-title">当前绩效周期</h2>
        </header>
        {cycles.isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : cycles.data?.data.length ? <div className="performance-cycle-summary">{cycles.data.data.map((cycle) => <div key={cycle.id}><strong>{cycle.name}</strong><span>{cycle.periodStart} 至 {cycle.periodEnd} · {cycle.instanceCount} 人</span></div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无进行中的绩效周期" />}
      </section>
    </section>
  );
}
